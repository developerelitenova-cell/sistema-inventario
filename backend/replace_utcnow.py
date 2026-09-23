import os
import glob

# Files to process
files = []
files.extend(glob.glob("backend/*.py"))
files.extend(glob.glob("backend/routes/*.py"))
files.extend(glob.glob("backend/services/*.py"))
files.extend(glob.glob("backend/tests/*.py"))

for file in files:
    if "venv" in file or file.endswith("replace_utcnow.py") or file.endswith("time_util.py"):
        continue

    with open(file, 'r') as f:
        content = f.read()

    if 'datetime.utcnow' in content:
        # Add import at the top
        if 'from time_util import get_colombia_time' not in content:
            content = 'from time_util import get_colombia_time\n' + content
        # Replace function call
        content = content.replace('datetime.utcnow', 'get_colombia_time')
        
        with open(file, 'w') as f:
            f.write(content)
        print(f"Updated {file}")

print("Done")
