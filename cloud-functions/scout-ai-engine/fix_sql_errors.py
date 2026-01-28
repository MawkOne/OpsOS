#!/usr/bin/env python3
"""
SQL Fixer Script - Intelligently fix detector SQL errors

Fixes:
- Table alias references (m., e.) throughout queries
- Entity_map JOINs
- Missing JOIN ON clauses
- CURRENT keyword issues
- is_active filters
"""

import re
import glob
import os
from typing import Optional, List, Tuple

class SQLFixer:
    def __init__(self):
        self.fixed_count = 0
        self.skipped_count = 0
        self.errors = []
        
    def extract_sql_query(self, content: str) -> Optional[Tuple[str, int, int]]:
        """Extract SQL query from Python file, return (query, start_pos, end_pos)"""
        # Match: query = f"""..."""
        pattern = r'query\s*=\s*f"""(.*?)"""'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            return match.group(1), match.start(1), match.end(1)
        return None
    
    def find_table_aliases(self, sql: str) -> List[str]:
        """Find all table aliases - both declared and orphaned references"""
        aliases = set()
        
        # Pattern 1: Declared aliases in FROM/JOIN clauses
        patterns = [
            r'FROM\s+`[^`]+`\s+(\w+)',
            r'JOIN\s+`[^`]+`\s+(\w+)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, sql, re.IGNORECASE)
            aliases.update(matches)
        
        # Pattern 2: Orphaned references (e.column, m.column)
        # Find all word.word patterns and extract the prefix
        orphaned = re.findall(r'\b([a-z])\.(\w+)', sql, re.IGNORECASE)
        for prefix, _ in orphaned:
            if len(prefix) == 1:  # Single letter aliases (m, e, r, h, etc.)
                aliases.add(prefix)
        
        return list(aliases)
    
    def fix_sql_query(self, sql: str, file_path: str) -> str:
        """Apply all SQL fixes"""
        original_sql = sql
        
        # 1. Find aliases before we remove them
        aliases = self.find_table_aliases(sql)
        
        # 2. Remove entity_map JOINs completely (including ON clause)
        # Pattern: JOIN `...entity_map...` e ON ... (up to next major keyword)
        sql = re.sub(
            r'\s*JOIN\s+`[^`]*entity_map[^`]*`\s+\w+\s+ON\s+[^\n]+(?:\n\s+AND\s+[^\n]+)*',
            '',
            sql,
            flags=re.IGNORECASE
        )
        
        # 3. Remove standalone ON clauses that reference entity_map
        sql = re.sub(
            r'\s*ON\s+\w+\.canonical_entity_id\s*=\s*\w+\.canonical_entity_id\s*',
            '',
            sql,
            flags=re.IGNORECASE
        )
        
        # 4. Remove is_active filters
        sql = re.sub(
            r'\s*AND\s+\w+\.is_active\s*=\s*TRUE\s*',
            '',
            sql,
            flags=re.IGNORECASE
        )
        
        # 5. Remove table aliases from FROM/JOIN clauses
        # FROM `table` m -> FROM `table`
        sql = re.sub(
            r'(FROM\s+`[^`]+`)\s+\w+',
            r'\1',
            sql,
            flags=re.IGNORECASE
        )
        sql = re.sub(
            r'(JOIN\s+`[^`]+`)\s+\w+',
            r'\1',
            sql,
            flags=re.IGNORECASE
        )
        
        # 6. Replace ALL alias references throughout query
        for alias in aliases:
            if len(alias) > 0 and len(alias) < 5:  # Sanity check for alias length
                # Replace alias.column with column
                sql = re.sub(
                    rf'\b{re.escape(alias)}\.(\w+)',
                    r'\1',
                    sql
                )
        
        # 7. Fix CURRENT keyword in SELECT (not in DATE functions)
        # CURRENT AS -> current_period AS
        sql = re.sub(
            r'\bCURRENT\s+AS\b',
            'current_period AS',
            sql,
            flags=re.IGNORECASE
        )
        
        # 8. Fix broken JOINs that lost their ON clause
        # Detect: JOIN table \n WHERE (should have ON)
        if re.search(r'JOIN\s+\w+\s*(?:\n|\r)\s*(?:WHERE|SELECT|GROUP|ORDER)', sql, re.IGNORECASE):
            self.errors.append(f"⚠️  {file_path}: Potential missing JOIN ON clause")
        
        # 9. Clean up multiple blank lines
        sql = re.sub(r'\n\s*\n\s*\n', '\n\n', sql)
        
        return sql
    
    def fix_detector_file(self, file_path: str) -> bool:
        """Fix SQL in a single detector file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract SQL query
            result = self.extract_sql_query(content)
            if not result:
                self.skipped_count += 1
                return False
            
            original_sql, start_pos, end_pos = result
            
            # Fix the SQL
            fixed_sql = self.fix_sql_query(original_sql, file_path)
            
            # Check if anything changed
            if fixed_sql == original_sql:
                self.skipped_count += 1
                # Debug: check if file has known issues
                if 'e.' in original_sql or 'm.' in original_sql:
                    print(f"⚠️  {os.path.basename(file_path)}: Has aliases but no changes made")
                return False
            
            # Replace in content
            new_content = content[:start_pos] + fixed_sql + content[end_pos:]
            
            # Write back
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            self.fixed_count += 1
            print(f"✅ Fixed: {os.path.basename(file_path)}")
            return True
            
        except Exception as e:
            error_msg = f"❌ Error in {file_path}: {str(e)}"
            self.errors.append(error_msg)
            print(error_msg)
            return False
    
    def fix_all_detectors(self, base_path: str):
        """Fix all detector files"""
        print("=" * 80)
        print("🤖 SQL FIXER AUTOMATION SCRIPT")
        print("=" * 80)
        print()
        
        # Find all detector files
        detector_files = []
        for pattern in ['**/*.py']:
            detector_files.extend(glob.glob(os.path.join(base_path, 'detectors', pattern), recursive=True))
        
        # Exclude __init__.py and this script
        detector_files = [f for f in detector_files if '__init__' not in f and 'fix_sql' not in f]
        
        print(f"Found {len(detector_files)} detector files")
        print()
        
        # Fix each file
        for file_path in sorted(detector_files):
            self.fix_detector_file(file_path)
        
        # Print summary
        print()
        print("=" * 80)
        print("📊 SUMMARY")
        print("=" * 80)
        print(f"✅ Fixed: {self.fixed_count} files")
        print(f"⏭️  Skipped: {self.skipped_count} files (no changes needed)")
        print(f"⚠️  Warnings: {len(self.errors)} issues")
        print()
        
        if self.errors:
            print("Issues requiring manual review:")
            for error in self.errors:
                print(f"  {error}")
            print()
        
        print(f"Total files processed: {len(detector_files)}")
        print("=" * 80)

if __name__ == "__main__":
    fixer = SQLFixer()
    base_path = os.path.dirname(os.path.abspath(__file__))
    fixer.fix_all_detectors(base_path)
