import hashlib

def sha256_hash(data: str) -> str:
    if not isinstance(data, str):
        data = str(data)
    
    hash_object = hashlib.sha256(data.encode('utf-8'))
    return hash_object.hexdigest()


def verify_hash(data: str, hash_value: str) -> bool:
    return sha256_hash(data) == hash_value


def combine_hashes(left_hash: str, right_hash: str) -> str:
    combined = left_hash + right_hash
    return sha256_hash(combined)
