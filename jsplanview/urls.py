from django.conf.urls.defaults import *
from django.conf import settings

import os.path
THIS_DIR = os.path.dirname(os.path.abspath(__file__))

urlpatterns = patterns('',
    (r'^test-django/', 'jsplanview.views.test_django'),

    (r'^$', 'jsplanview.views.index'),
    (r'^(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': THIS_DIR + '/static'}),
)

