# planview - Query Plan Visualizer
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

import os

from django.http import HttpResponse

def index(request,
    fn = os.path.dirname(os.path.abspath(__file__)) + "/static/index.html"):
    """TODO: isn't there a way to do this using static serve?
    Probably no: there are better ways to serve static files than django.
    """
    return HttpResponse(open(fn).read())

def test_django(request):
    import django
    return HttpResponse("Django version: %r" % (django.VERSION,),
        mimetype="text/plain")

