"""PostgreSQL query plan parser."""

# Copyright (C) 2010  Daniele Varrazzo
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

import re

from planview.query import QueryNode

def parse_plan(s):
    """Parse a PostgreSQL EXPLAIN ANALYZE command output."""
    parser = PGPlanParser()
    for line in s.splitlines():
        parser.add_line(line)
    return parser.stack[0][0]

class PGPlanParser:
    """Parser for PostgreSQL EXPLAIN ANALYZE command output."""
    def __init__(self):
        self.stack = []
        self.nline = 0

    def add_line(self, line):
        self.nline += 1

        if not line or line.isspace():
            return

        # clean quotes, e.g. from pgadmin
        if line[0] == '"':
            line = line.rstrip()
            if line[-1] == '"':
                line = line[1:-1]

        if self.node_start(line):
            node, level = self.make_node(line)

            while not self.empty() and self.top_level() >= level:
                self.pop()

            if not self.empty():
                self.top_node().add_child(node)

            self.push([node, level])

        else:
            self.add_detail(line)

    _re_node = re.compile(
        r'^(\s+->\s+|\s+)?([^\s][^\(]+?)\s*(\(cost=.*)$')
    _re_timing = re.compile(
        r'\((cost=(\d+(?:\.\d+))..(\d+(?:\.\d+)) rows=(\d+) width=(\d+))\)'
        '(?:\s+\((actual time=(\d+(?:\.\d+))..(\d+(?:\.\d+)) '
        'rows=(\d+) loops=(\d+))\))?')

    def node_start(self, line):
        return self._re_node.match(line) is not None

    _node_id = 0

    def make_node(self, line):
        match = self._re_node.match(line)
        level = len(match.group(1) or "")
        label = match.group(2)
        timing = match.group(3)

        node = QueryNode(label)
        node.id = self._node_id
        self._node_id += 1
        self.parse_timing(node, timing)
        return (node, level)

    def parse_timing(self, node, timing):
        match = self._re_timing.match(timing)
        if match is None:
            raise ValueError("bad timing string: %r" % timing)

        node.planned = {
            'startup': float(match.group(2)),
            'total': float(match.group(3)),
            'rows': int(match.group(4)),
            'width': int(match.group(5)), }

        node.details.append("Planned: " + match.group(1))

        if match.group(7):
            detail = match.group(6)
            node.executed = {
                'startup': float(match.group(7)),
                'total': float(match.group(8)),
                'rows': int(match.group(9)),
                'loops': int(match.group(10)), }

            if node.has_bad_rows():
                detail = re.sub(r'rows=\d+',
                    r'<strong class="bad">$1</strong>', detail)

            node.details.append("Executed: " + detail)

    def add_detail(self, line):
        self.top_node().add_detail(line.lstrip())

    def empty(self):
        return not self.stack

    def push(self, item):
        self.stack.append(item)

    def pop(self):
        if self.empty():
            raise ValueError("can't pop empty stack")
        return self.stack.pop()

    def top(self):
        if self.empty():
            raise ValueError("empty stack has no top")
        return self.stack[-1]

    def top_node(self):
        return self.top()[0]

    def top_level(self):
        return self.top()[1]


