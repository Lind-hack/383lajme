"""Load a complete local query before invoking the unchanged Hermes CLI parser.

The installed Hermes CLI has no --query-file option. Passing its -q value in
process memory avoids Windows and Linux argv limits without enabling file tools.
"""
import argparse
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--query-file',type=Path,required=True)
    parser.add_argument('arguments',nargs=argparse.REMAINDER)
    args=parser.parse_args()
    arguments=args.arguments[1:] if args.arguments[:1]==['--'] else args.arguments
    if not arguments or arguments[-1] not in {'-q','--query'}:
        raise ValueError('complete query transport requires the original Hermes query flag')
    sys.argv=['hermes',*arguments,args.query_file.read_text(encoding='utf-8')]
    from hermes_cli.main import main as hermes_main
    hermes_main()


if __name__=='__main__':main()
