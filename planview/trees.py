"""Generic trees handling."""

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

from weakref import ref

class Tree(object):
    def __init__(self):
        self.children = []
        self._parent = None

    @property
    def parent(self):
        return self._parent and self._parent() or None

    def add_child(self, child):
        self.children.append(child)
        child._parent = ref(self)

