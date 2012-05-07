/*
 * planview -- Query Plan Visualizer
 * Copyright (C) 2010  Daniele Varrazzo
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
planview = {};

(function (mod)
{

  /* Parse a complete query plan and return a parsed tree. */
  mod.parsePlan = function(str)
  {
    var lines = str.split("\n");
    var parser = new mod.PGPlanParser();
    for (var i = 0, ii = lines.length; i < ii; ++i) {
      parser.addLine(lines[i]);
    }
    return parser.stack[0][0];
  }

  /* Render an entire dataset into a target container */
  mod.renderTimeline = function(node, tgt, dataset)
  {
    var renderer = new mod.TimelineRenderer(node, tgt);
    renderer.dataset = dataset;
    renderer.render();
  }

  /* Render a complete report into a target container */
  mod.renderReport = function(plan, tgt) {
    if ('' == mod.lstrip(plan)) {
      throw "no query plan provided";
    }

    var node = planview.parsePlan(plan);
    tgt.append($("<h3>planned</h3>"));
    planview.renderTimeline(node, tgt, "planned");

    if (node.executed) {
      tgt.append($("<h3>executed</h3>"));
      planview.renderTimeline(node, tgt, "executed");
    }
  }

  mod.PGPlanParser = function()
  {
    this.stack = [];
    this.nline = 0;
    this.tmp_line = "";
  }

  var re_node = /^(\s+->\s+|\s+)?([^\s][^\(]+?)\s*(\(cost=.*)$/;
  var re_timing = /\((cost=(\d+(?:\.\d+))..(\d+(?:\.\d+)) rows=(\d+) width=(\d+))\)(?:\s+\((actual time=(\d+(?:\.\d+))..(\d+(?:\.\d+)) rows=(\d+) loops=(\d+))\))?/;

  mod.PGPlanParser.prototype =
  {
    addLine: function(line)
    {
      this.nline += 1;

      // clean quotes, e.g. from pgadmin
      if (line[0] == '"') {
        line = $.trim(line);
        if (line[line.length-1] == '"') {
          line = line.substring(1, line.length - 1);
        }
      }

      if (this.nodeStart(line)) {
        var pair = this.makeNode(line);
        var node = pair[0];
        var level = pair[1];

        while (!this.empty() && this.topLevel() >= level) {
          this.pop();
        }
        if (!this.empty()) {
          this.topNode().addChild(node);
        }
        this.push([node, level]);
      }
      else {
        this.addDetail(line);
      }
    },

    nodeStart: function(line)
    {
      return re_node.test(line);
    },

    _node_id: 0,

    makeNode: function(line)
    {
      var match = re_node.exec(line);
      var level = (match[1] || "").length;
      var label = match[2];
      var timing = match[3];

      var node = new mod.QueryNode(label);
      node.id = ++this._node_id;
      this.parseTiming(node, timing);
      return [node, level];
    },

    parseTiming: function(node, timing)
    {
      var match = re_timing.exec(timing);
      if (!match) { throw "bad timing string: " + timing; }
      node.planned = {
        startup: parseFloat(match[2]),
        total: parseFloat(match[3]),
        rows: parseInt(match[4]),
        width: parseInt(match[5]),
      }
      node.details.push("Planned: " + match[1]);

      if (match[7]) {
        var detail = match[6];
        node.executed = {
          startup: parseFloat(match[7]),
          total: parseFloat(match[8]),
          rows: parseInt(match[9]),
          loops: parseInt(match[10]),
        };
        if (node.hasBadRows(node)) {
          detail = detail.replace(/(rows=\d+)/, '<strong class="bad">$1</strong>');
        }
        node.details.push("Executed: " + detail);
      }
    },

    addDetail: function(line)
    {
      line = mod.lstrip(line);
      this.topNode().addDetail(line);
    },

    empty: function()
    {
      return (this.stack.length == 0);
    },
    push: function(item)
    {
      this.stack.push(item);
    },
    pop: function()
    {
      if (this.empty()) { throw "can't pop empty stack" }
      return this.stack.pop();
    },
    top: function()
    {
      if (this.empty()) { throw "empty stack has no top" }
      return this.stack[this.stack.length - 1];
    },
    topNode: function()
    {
      return this.top()[0];
    },
    topLevel: function()
    {
      return this.top()[1];
    },
  }

  mod.QueryNode = function(label)
  {
    this.id = null;
    this.label = label;
    this.details = [];
    this.children = [];
    this.planned = this.executed = null;
  }
  mod.QueryNode.prototype =
  {
    addDetail: function(s)
    {
      this.details.push(s);
    },

    addChild: function(s)
    {
      this.children.push(s);
    },

    getLabel: function(dataset)
    {
      var repeats = this[dataset]._repeats;
      return (((repeats && repeats > 1) ? "(" + repeats + "x) " : '') + this.label);
    },

    hasBadRows: function() {
      if (null === this.executed) { return false; }
      var rows_planned = this.planned.rows;
      var rows_executed = this.executed.rows;
      return rows_executed > rows_planned * 2 || rows_executed < rows_planned * 0.5;
    },

    /* Return the start and end times for the node 
     * TODO: the result is wrong for repeated nested loops */
    getActiveRange: function(dataset, parent) {
      var data = this[dataset];
      var start = data.startup;
      var end = data.total;

      /* Correctly multiply and shift nested node in executed time 
       * TODO: the isNesting() test probably needs wider testing. */
      // In a nested loop, the repeated node is the second child
      if (parent && parent._isNesting() && this === parent.children[1]) {
        var bro = parent.children[0];
        var offset = bro[dataset].startup;
        if (dataset === 'executed') {
          data._repeats = data.loops;
        } else { // dataset == 'planned'
          // TODO: not sure about that.
          data._repeats = bro[dataset].rows;
        }
        end *= data._repeats;
        start += offset;
        end += offset;
      }
      return [start, end];
    },

    /* Return true if the node representing a nesting operation.
     * In such operations the 2nd child can be repeated many times. */
    _isNesting: function() {
      return (0 == this.label.search('Nested'));
    },
  }

  mod.TimelineRenderer = function(node, target)
  {
    this.node = node;
    this.target = target;
    this.dataset = 'planned';
  }

  mod.TimelineRenderer.prototype =
  {
    // Configurable parameters
    bar_height: 20,
    margin_x: 20,
    label_offset: 20,
    curve_control_length: 40,

    /* Render a chart from a dataset on `node` to `target`. */
    render: function()
    {
      this._makeChart();

      // Allow the closures to access this;
      var self = this;

      this._svg.svg(function (svg) {
        self._iterNode(function (node, y, parent) {
          var bar_left, bar_right;
          var range = self._getNodeRange(node, parent);
          bar_left = self._p2x(range[0]);
          bar_right = self._p2x(range[1]);
          if (bar_right < 2 + bar_left) { bar_right = 2 + bar_left; }
          var bar_width = bar_right - bar_left;

          var attrs = self._getBarColour(node);
          attrs['strokeWidth'] = 1;
          attrs['class'] = self._getNodeId(node);
          svg.rect(bar_left, y + 2, bar_width, self.bar_height - 4, attrs);

          // Store the key points where to draw lines
          self._data(node).start_point = [bar_left, y + 0.5 * self.bar_height];
          self._data(node).end_point = [bar_right, y + 0.5 * self.bar_height];
        });

        self._iterNode(function (node, y, parent) {
          // Plot the curves to the child nodes (already drawn)
          $.each(node.children, function (i, child)
          {
            if (null === self._data(child)) { return; }
            var end_point = self._data(node).start_point;

            // Check if the child is sequential or parallel to the parent
            var start_point, color;
            if (self._getNodeRange(node, parent)[0] < self._getNodeRange(child, node)[1]) {
              start_point = self._data(child).start_point;
              color = '#0c0';
            } else {
              start_point = self._data(child).end_point;
              color = '#c00';
            }

            svg.path(svg.createPath()
              .move(
                start_point[0], start_point[1])
              .curveC(
                start_point[0] + self.curve_control_length, start_point[1],
                end_point[0] - self.curve_control_length, end_point[1],
                end_point[0], end_point[1] + i * 4 - 2),
              {fill: 'none', stroke: color, strokeWidth: 3});
          });
        });

        self._iterNode(function (node, y, parent) {
          // Find the best point to put the label (on, before, after the bar)
          var label_x,
              label_y = y + self.bar_height - 5,
              label_attr = {
                'font-size': '80%',
                'class': self._getNodeId(node),};

          var pair = self._getNodeRange(node, parent);
          var start = pair[0];
          var end = pair[1];
          var width = self._getChartWidth();
          if ((end - start) > 0.4 * width) {
            label_x = self._data(node).start_point[0] + self.label_offset;
          } else if (end < 0.5 * width) {
            label_x = self._data(node).end_point[0] + self.label_offset;
          } else {
            label_x = self._data(node).start_point[0] - self.label_offset;
            label_attr['text-anchor'] = 'end';
          }

          svg.text(label_x, label_y, node.getLabel(self.dataset), label_attr);
        });

        self._iterNode(function (node, y) {
          // Create the tooltip div for the node.
          var base_id = self._getNodeId(node);
          var tt = $('<div class="tooltip"></div>')
            .attr('id', 'tip-' + base_id)
            .insertAfter(self._chart);
          $.each(node.details, function(i, d) {
            tt.append("<p>" + d.replace(/^([^:]+:)/, "<strong>$1</strong>") + "</p>");
          });

          // Install the tooltip on the bars and the labels
          $('.' + base_id).tooltip({
            bodyHandler: function() { return $('#tip-' + base_id).html(); }
          });

        });
      });
    },

    /* Return the total width of the chart in data units. */
    _getChartWidth: function() {
      var tot_width = this._getNodeRange(this.node)[1]; // in data unit
      if (!tot_width) throw "no plan time found";
      return tot_width;
    },

    /* Return start and end times of a node */
    _getNodeRange: function(node, parent) {
      return node.getActiveRange(this.dataset, parent);
    },

    /* Create the chart div and configure the scale and other amenities. 
     *
     * Create the div containing the svg and return the svg contained in it.
     * Set the value for `_scale_x` to be used by the method `_d2x()`.
     */
    _makeChart: function() {
      // Create the chart container
      var chart = this._chart = $('<div class="bar-chart"></div>')
        .appendTo(this.target);

      // Calculate width and scale of the plot
      var tot_width_px = chart.innerWidth();
      this._scale_x = (tot_width_px - 2 * this.margin_x) / this._getChartWidth();

      var tot_height_px = mod.countNodes(this.node) * this.bar_height;
      chart.css("height", tot_height_px);

      // Create the svg overlay
      this._svg = $('<div class="svg"></div>')
        .appendTo(chart)
        .width(this.target.outerWidth())
        .height(tot_height_px);
    },

    /* Return the id for a node. */
    _getNodeId: function(node, prefix) {
      return (prefix || '') + self.dataset + '-' + node.id;
    },

    /* Return the colour of a bar. 
     * Currently red bars mean an error of more than 100% in the returned rows
     * w.r.t. what was planned. */
    _getBarColour: function(node) {
      var rv = {fill: '#44F', stroke: 'navy'};
      if (this.dataset !== 'executed') { return rv; }

      if (node.hasBadRows()) {
        rv = {fill: '#F44', stroke: 'maroon'};
      }

      return rv;
    },
 
    /* Extract the data from a node.
     * Allows to choose between rendering either planned or executed time. */
    _data: function(node) {
      return node[this.dataset !== 'executed' ? 'planned' : 'executed'];
    },

    /* Convert from the numerical value to render to x position on the chart. 
     * The `_makeChart()` method must be called before using this method. */
    _p2x: function(t) {
      return this._scale_x * t + this.margin_x;
    },

    /* Iterate a function over the nodes of the tree to be rendered.
     * f has signature f(node, y) where y is the vertical position of the node.
     */
    _iterNode: function(f)
    {
      var self = this;
      mod.walkDepthFirst(this.node, 0, function(node, y, parent) {
        if (null === self._data(node)) { return y; } // never exec'd node
        f(node, y, parent);
        return y + self.bar_height;
      });
    },

  }

  mod.lstrip = function(s)
  {
    return s.replace(/^\s*/, "");
  }

  mod.walkDepthFirst = function(tree, acc, f, parent)
  {
    $.each(tree.children, function (i, child) {
      acc = mod.walkDepthFirst(child, acc, f, tree);
    });
    return f(tree, acc, parent);
  }

  mod.countNodes = function(tree)
  {
    return mod.walkDepthFirst(tree, 0, function(t, acc) { return acc + 1 });
  }

})(planview);

