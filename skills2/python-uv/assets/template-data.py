#!/usr/bin/env -S uv run --quiet
# /// script
# dependencies = [
#   "pandas>=2.0.0",
#   "openpyxl>=3.1.0",
# ]
# requires-python = ">=3.11"
# ///
"""
Data Processing Template

A template for data processing tasks using pandas.
Supports reading from CSV/Excel and writing results.
"""

import sys
import pandas as pd


def process_data(input_file):
    """
    Read and process data from input file.

    Args:
        input_file: Path to CSV or Excel file

    Returns:
        Processed DataFrame
    """
    # Read data (automatically handles CSV and Excel)
    if input_file.endswith(".csv"):
        df = pd.read_csv(input_file)
    elif input_file.endswith((".xlsx", ".xls")):
        df = pd.read_excel(input_file)
    else:
        raise ValueError(f"Unsupported file format: {input_file}")

    print(f"Loaded {len(df)} rows from {input_file}")
    print(f"Columns: {', '.join(df.columns)}")

    # Example processing: group by first column and sum numeric columns
    if len(df.columns) > 1:
        result = df.groupby(df.columns[0]).sum(numeric_only=True)
    else:
        result = df

    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: ./script.py <input_file> [output_file]")
        print("Example: ./script.py data.csv output.csv")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    # Process data
    result = process_data(input_file)

    # Display results
    print("\nResults:")
    print(result.to_string())

    # Write to output if specified
    if output_file:
        if output_file.endswith(".csv"):
            result.to_csv(output_file)
        elif output_file.endswith((".xlsx", ".xls")):
            result.to_excel(output_file)
        else:
            result.to_csv(output_file)
        print(f"\n✓ Saved to {output_file}")


if __name__ == "__main__":
    main()
