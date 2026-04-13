import bcrypt

# Hash para password "admin123"
password = b"admin123"
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed.decode())