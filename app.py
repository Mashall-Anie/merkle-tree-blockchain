
from flask import Flask, render_template, request, jsonify
from core import MerkleTree, sha256_hash

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
        
        current_tree = MerkleTree(data)
        
        return jsonify({
            'success': True,
            'root_hash': current_tree.get_root_hash(),
            'stats': current_tree.get_statistics(),
            'tree_structure': current_tree.print_tree(verbose=False),
            'leaf_count': current_tree.get_leaf_count(),
            'depth': current_tree.get_tree_depth(),
            'height': current_tree.get_tree_height()
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
        
        return jsonify({
            'success': True,
            'index': index,
            'leaf_data': leaf_data,
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
        
        is_valid = current_tree.verify_proof(leaf_data, proof)
        
        return jsonify({
            'success': True,
            'is_valid': is_valid,
            'leaf_data': leaf_data,
            'root_hash': current_tree.get_root_hash(),
            'message': '✅ Proof hợp lệ!' if is_valid else '❌ Proof không hợp lệ!'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/demo-detect', methods=['POST'])
def demo_detect():
    global current_tree
    
    try:
        if current_tree is None:
            return jsonify({
                'success': False,
                'error': 'Vui lòng xây dựng tree trước!'
            }), 400
        
        req_data = request.get_json()
        original_data = req_data.get('original_data', '').strip()
        modified_data = req_data.get('modified_data', '').strip()
        proof = req_data.get('proof', [])
        
        is_original_valid = current_tree.verify_proof(original_data, proof)
        is_modified_valid = current_tree.verify_proof(modified_data, proof)
        
        return jsonify({
            'success': True,
            'original_data': original_data,
            'modified_data': modified_data,
            'original_valid': is_original_valid,
            'modified_valid': is_modified_valid,
            'detection_success': is_original_valid and not is_modified_valid,
            'message': '✅ Phát hiện thay đổi thành công!' if (is_original_valid and not is_modified_valid) else '⚠️ Demo không như mong đợi'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
