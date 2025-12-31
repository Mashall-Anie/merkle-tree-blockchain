"""
Merkle Tree Core Package
Code thuần Python - không dùng thư viện bên ngoài
"""

from .merkle_tree import MerkleTree
from .hash_utils import sha256_hash

__all__ = ['MerkleTree', 'sha256_hash']
__version__ = '1.0.0'
