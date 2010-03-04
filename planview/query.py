"""Database query representation."""

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

from planview.trees import Tree

class QueryNode(Tree):
    """A tree representing a query execution step."""
    def __init__(self, label):
        super(QueryNode, self).__init__()
        self.id = None
        self.label = label
        self.details = []
        self.planned = self.executed = None

    def add_detail(self, s):
        self.details.append(s)

    def get_label(self, dataset):
        repeats = getattr(self, dataset.get('_repeats'))
        return ((repeats and repeats > 1) and "(%sx)" % repeats or ""
            + self.label)

    def has_bad_rows(self):
        if self.executed is None:
            return False
        rp = self.planned['rows']
        re = self.executed['rows']
        return not rp * 2 >= re >= rp // 2

    # Return the start and end times for the node
    def get_active_range(self, dataset):
        data = getattr(self, dataset)
        start = data['startup']
        end = data['total']

        # Correctly multiply and shift nested node in executed time
        # TODO: the isNesting() test probably needs wider testing.

        # In a nested loop, the repeated node is the second child
        parent = self.parent
        if parent is not None and parent._is_nesting() \
        and self is parent.children[1]:
            bro = parent.children[0]
            offset = getattr(bro, dataset)['startup']
            if dataset == 'executed':
                r = data['_repeats'] = data['loops']
            else: # planned
                # TODO: not sure about that
                r = data['_repeats'] = getattr(bro, dataset)['rows']

            end *= r
            start += offset
            end += offset

        return start, end

    # Return true if the node representing a nesting operation.
    # In such operations the 2nd child can be repeated many times.
    def _is_nesting(self):
        return self.label.startswith('Nested')



