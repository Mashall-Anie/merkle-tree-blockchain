import math
from typing import List, Optional, Dict, Any
from .hash_utils import sha256_hash, combine_hashes

class MerkleNode:
    def __init__(self, hash_value: str, left=None, right=None):
        self.hash = hash_value
        self.left = left
        self.right = right
        self.is_leaf = (left is None and right is None)

    def __repr__(self):
        hash_short = self.hash[:16] + "..." if len(self.hash) > 16 else self.hash
        node_type = "Leaf" if self.is_leaf else "Internal"
        return f"MerkleNode({node_type}: {hash_short})"

    def get_hash_short(self, length: int = 16) -> str:
        return self.hash[:length] + "..." if len(self.hash) > length else self.hash

    def to_dict(self) -> dict:
        return {
            'hash': self.hash,
            'is_leaf': self.is_leaf,
            'hash_short': self.get_hash_short(32),
            'has_left': self.left is not None,
            'has_right': self.right is not None
        }


class MerkleTree:
    def __init__(self, data: List[str]):
        if not data or len(data) == 0:
            raise ValueError("Data không được rỗng!")

        self.data = data
        self.leaves = []
        self.tree = []
        self.root = None
        self._build_tree()

    def _build_tree(self):
        self.leaves = []
        for item in self.data:
            hash_value = sha256_hash(item)
            leaf = MerkleNode(hash_value)
            self.leaves.append(leaf)

        current_level = self.leaves.copy()
        self.tree = [current_level]

        while len(current_level) > 1:
            next_level = []

            if len(current_level) % 2 != 0:
                current_level.append(current_level[-1])

            for i in range(0, len(current_level), 2):
                left_node = current_level[i]
                right_node = current_level[i + 1]

                parent_hash = combine_hashes(left_node.hash, right_node.hash)
                parent = MerkleNode(parent_hash, left_node, right_node)
                next_level.append(parent)

            self.tree.append(next_level)
            current_level = next_level

        self.root = current_level[0] if current_level else None

    def get_root_hash(self) -> str:
        return self.root.hash if self.root else None

    def get_tree_depth(self) -> int:
        return len(self.tree)

    def get_tree_height(self) -> int:
        return len(self.tree) - 1

    def get_leaf_count(self) -> int:
        return len(self.leaves)

    def generate_proof(self, index: int) -> Optional[List[Dict[str, Any]]]:
        if index < 0 or index >= len(self.leaves):
            return None

        proof = []
        current_index = index

        for level in range(len(self.tree) - 1):
            is_left_child = current_index % 2 == 0
            sibling_index = current_index + 1 if is_left_child else current_index - 1
            
            if sibling_index < len(self.tree[level]):
                sibling_node = self.tree[level][sibling_index]
                proof.append({
                    'hash': sibling_node.hash,
                    'position': 'right' if is_left_child else 'left',
                    'level': level,
                    'hash_short': sibling_node.get_hash_short(32)
                })

            current_index = current_index // 2
        return proof

    def verify_proof(self, leaf_data: str, proof: List[Dict[str, Any]]) -> bool:
        if not proof:
            return False

        computed_hash = sha256_hash(leaf_data)
        for step in proof:
            sibling_hash = step['hash']
            position = step['position']
            
            if position == 'right':
                computed_hash = combine_hashes(computed_hash, sibling_hash)
            else:
                computed_hash = combine_hashes(sibling_hash, computed_hash)
        return computed_hash == self.root.hash

    def print_tree(self, verbose: bool = False) -> str:
        output = []
        output.append("=" * 80)
        output.append(f"MERKLE TREE STRUCTURE (Depth: {self.get_tree_depth()}, Height: {self.get_tree_height()})")
        output.append("=" * 80)

        for level in range(len(self.tree) - 1, -1, -1):
            level_label = "ROOT" if level == len(self.tree) - 1 else f"Level {level}"
            output.append(f"\n{level_label} ({len(self.tree[level])} nodes):")
            output.append("-" * 80)

            for i, node in enumerate(self.tree[level]):
                if verbose:
                    output.append(f"  [{i}] {node.hash}")
                else:
                    output.append(f"  [{i}] {node.get_hash_short(32)}...")

        output.append("\n" + "=" * 80)
        return "\n".join(output)

    def get_statistics(self) -> dict[str, Any]:
        return {
            'leaf_count': self.get_leaf_count(),
            'tree_depth': self.get_tree_depth(),
            'tree_height': self.get_tree_height(),
            'root_hash': self.get_root_hash(),
            'root_hash_short': self.root.get_hash_short(32) if self.root else None,
            'proof_size': math.ceil(math.log2(self.get_leaf_count())) if self.get_leaf_count() > 0 else 0,
            'time_complexity_build': 'O(n log n)',
            'time_complexity_proof': 'O(log n)',
            'time_complexity_verify': 'O(log n)',
            'space_complexity': 'O(n)'
        }
