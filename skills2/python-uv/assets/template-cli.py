#!/usr/bin/env -S uv run --quiet
# /// script
# dependencies = [
#   "click>=8.1.0",
# ]
# requires-python = ">=3.11"
# ///
"""
CLI Tool Template

A basic command-line tool template using Click for argument parsing.
Customize this template for your CLI application needs.
"""

import click


@click.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="Output file path")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.option("--count", "-c", default=1, type=int, help="Number of iterations")
def main(input_file, output, verbose, count):
    """
    Process INPUT_FILE and generate output.

    Example usage:
        ./script.py input.txt -o output.txt -v -c 5
    """
    if verbose:
        click.echo(f"Processing: {input_file}")
        click.echo(f"Output: {output or 'stdout'}")
        click.echo(f"Count: {count}")

    # Your processing logic here
    with open(input_file, "r") as f:
        content = f.read()

    result = f"Processed {count} times:\n{content}"

    if output:
        with open(output, "w") as f:
            f.write(result)
        if verbose:
            click.echo(f"✓ Written to {output}")
    else:
        click.echo(result)


if __name__ == "__main__":
    main()
