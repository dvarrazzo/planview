"""PostgreSQL parser test suite."""

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

import unittest
from testutils import *

from planview.parser import postgres

class PostgresPlanParserTestCase(unittest.TestCase):
    def test_parsing(self):
        """Test a query plan parsing."""
        self.check_plan1(postgres.parse_plan(self.plan("plan1")))

    def test_parsing_prefix(self):
        """Test a query plan parsing with whitespace prefix."""
        self.check_plan1(postgres.parse_plan(" " + self.plan("plan1")))

    def test_parsing_quoted(self):
        """Test a query plan parsing in quotes (as pasted by PGAdmin)"""
        self.check_plan2(postgres.parse_plan(self.plan("plan2")))

    def check_plan1(self, node):
        self.assertEqual(node.label, 'Subquery Scan "*SELECT*"', "node label")
        self.assertEqual(len(node.children), 1, "children no.")
        self.assertEqual(node.planned['startup'], 3998159.58, "planned start")
        self.assertEqual(node.planned['total'], 4017423.33, "planned end")
        self.assertEqual(node.planned['rows'], 19757, "planned rows")
        self.assertEqual(node.executed['startup'], 2252714.704, "executed start")
        self.assertEqual(node.executed['total'], 2291343.377, "executed end")
        self.assertEqual(node.executed['rows'], 9629, "executed rows")

    def check_plan2(self, node):
        self.assertEqual(node.label, 'Nested Loop', "node label")
        self.assertNotEqual(None, node.executed, "root node executed")
        self.assertEqual(None, node.children[1].executed, "never executed node")

    def plan(self, name):
        return open(get_data_file(name + ".txt")).read()

