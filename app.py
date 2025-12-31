from flask import Flask, render_template, request, jsonify
from core import MerkleTree
from core.hash_utils import sha256_hash, combine_hashes

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

current_tree = None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/build-tree', methods=['POST'])
def build_tree():
    global current_tree
    
    try:
        data = request.get_json().get('data', [])
        
        if not data or len(data) == 0:
            return jsonify({
                'success': False,
                'error': 'Dữ liệu không được rỗng!'
            }), 400
        
        data = [str(item).strip() for item in data if str(item).strip()]
        
        if len(data) == 0:
            return jsonify({
                'success': False,
                'error': 'Dữ liệu sau lọc không được rỗng!'
            }), 400
        
        if len(data) > 200:
            return jsonify({
                'success': False,
                'error': f'Vượt quá giới hạn! Tối đa 200 dòng dữ liệu (hiện tại: {len(data)} dòng)'
            }), 400
        
        current_tree = MerkleTree(data)
        
        # Create indexed data list for dropdowns
        data_list = [{'index': i, 'data': item} for i, item in enumerate(data)]
        
        return jsonify({
            'success': True,
            'root_hash': current_tree.get_root_hash(),
            'stats': current_tree.get_statistics(),
            'tree_structure': current_tree.print_tree(verbose=False),
            'tree_levels': current_tree.get_tree_levels_data(),
            'leaf_count': current_tree.get_leaf_count(),
            'depth': current_tree.get_tree_depth(),
            'height': current_tree.get_tree_height(),
            'data_list': data_list
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/generate-proof', methods=['POST'])
def generate_proof():
    global current_tree
    
    try:
        if current_tree is None:
            return jsonify({
                'success': False,
                'error': 'Vui lòng xây dựng tree trước!'
            }), 400
        
        index = request.get_json().get('index')
        
        if not isinstance(index, int) or index < 0 or index >= current_tree.get_leaf_count():
            return jsonify({
                'success': False,
                'error': f'Chỉ số không hợp lệ! (0-{current_tree.get_leaf_count()-1})'
            }), 400
        
        proof = current_tree.generate_proof(index)
        leaf_data = current_tree.data[index]
        leaf_hash = current_tree.leaves[index].hash
        
        return jsonify({
            'success': True,
            'index': index,
            'leaf_data': leaf_data,
            'leaf_hash': leaf_hash,
            'leaf_hash_short': leaf_hash[:16] + '...',
            'root_hash': current_tree.get_root_hash(),
            'proof': proof,
            'proof_steps': len(proof)
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/verify-proof', methods=['POST'])
def verify_proof():
    global current_tree
    
    try:
        if current_tree is None:
            return jsonify({
                'success': False,
                'error': 'Vui lòng xây dựng tree trước!'
            }), 400
        
        req_data = request.get_json()
        leaf_data = req_data.get('leaf_data', '').strip()
        proof = req_data.get('proof', [])
        
        if not leaf_data:
            return jsonify({
                'success': False,
                'error': 'Phần tử không được rỗng!'
            }), 400
        
        if not proof or len(proof) == 0:
            return jsonify({
                'success': False,
                'error': 'Proof không được rỗng!'
            }), 400

        computation_steps = []
        computed_hash = sha256_hash(leaf_data)
        
        # Step 0: Initial leaf hash
        computation_steps.append({
            'step': 0,
            'type': 'leaf',
            'input': leaf_data,
            'result': computed_hash,
            'result_short': computed_hash[:16] + '...'
        })
        
        # Steps 1-N: Combine with siblings
        for i, step in enumerate(proof):
            sibling_hash = step['hash']
            position = step['position']
            
            if position == 'right':
                new_hash = combine_hashes(computed_hash, sibling_hash)
                left_hash = computed_hash
                right_hash = sibling_hash
                position = 'left'
            else:
                new_hash = combine_hashes(sibling_hash, computed_hash)
                left_hash = sibling_hash
                right_hash = computed_hash
                position = 'right'
            
            computation_steps.append({
                'step': i + 1,
                'type': 'combine',
                'level': step['level'],
                'position': position,
                'current_hash': computed_hash[:16] + '...',
                'sibling_hash': sibling_hash[:16] + '...',
                'sibling_hash_full': sibling_hash,
                'left_hash': left_hash[:16] + '...',
                'right_hash': right_hash[:16] + '...',
                'result': new_hash,
                'result_short': new_hash[:16] + '...'
            })
            
            computed_hash = new_hash
        
        is_valid = computed_hash == current_tree.get_root_hash()
        
        return jsonify({
            'success': True,
            'is_valid': is_valid,
            'leaf_data': leaf_data,
            'computed_hash': computed_hash,
            'computed_hash_short': computed_hash[:32] + '...',
            'root_hash': current_tree.get_root_hash(),
            'root_hash_short': current_tree.get_root_hash()[:32] + '...',
            'computation_steps': computation_steps,
            'message': 'Proof hợp lệ!' if is_valid else 'Proof không hợp lệ!'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
