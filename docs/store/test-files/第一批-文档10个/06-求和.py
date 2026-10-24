# DSX-PY-06: standalone demonstration, no network or file operations.
def total_quantity(items):
    return sum(item["quantity"] for item in items)

if __name__ == "__main__":
    items = [{"name": "纸飞机", "quantity": 2}, {"name": "纸船", "quantity": 3}, {"name": "纸风车", "quantity": 5}]
    print(total_quantity(items))  # expected: 10
# PY-END
