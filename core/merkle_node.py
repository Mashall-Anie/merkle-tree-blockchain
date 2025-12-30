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
