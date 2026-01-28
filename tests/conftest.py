"""Test configuration"""
# Python imports
import sys
import pathlib

__file_dir__ = pathlib.Path(__file__).absolute().parent

# Add src directory to Python path so imports work
project_root = __file_dir__.parent
src_path = project_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))
