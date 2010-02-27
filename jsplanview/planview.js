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

  mod.renderTimeline = function(node, tgt, dataset)
  {
    var renderer = new mod.TimelineRenderer(node, tgt);
    renderer.render(dataset);
  }

  mod.PGPlanParser = function()
  {
    this.stack = [];
    this.nline = 0;
    this.tmp_line = "";
  }

  var re_node = /^(\s+->\s+)?([^\s][^\(]+?)\s*(\(.*)$/;
  var re_timing = /\(cost=(\d+(?:\.\d+))..(\d+(?:\.\d+)) rows=(\d+) width=(\d+)\)(?:\s+\(actual time=(\d+(?:\.\d+))..(\d+(?:\.\d+)) rows=(\d+) loops=(\d+))?/

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

      var node;
      var level;
      if (this.nodeStart(line)) {
        [node, level] = this.makeNode(line);

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

    makeNode: function(line)
    {
      var match = re_node.exec(line);
      var level = (match[1] || "").length;
      var label = match[2];
      var timing = match[3];

      var node = new mod.QueryNode(label);
      this.parseTiming(node, timing);
      return [node, level];
    },

    parseTiming: function(node, timing)
    {
      var match = re_timing.exec(timing);
      if (!match) { throw "bad timing string: " + timing; }
      node.planned = {
        start: parseFloat(match[1]),
        end: parseFloat(match[2]),
        rows: parseInt(match[3]),
      }
      if (match[5]) {
        node.executed = {
          start: parseFloat(match[5]),
          end: parseFloat(match[6]),
          rows: parseInt(match[7]),
        }
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
  }

  mod.TimelineRenderer = function(node, target)
  {
    this.node = node;
    this.target = target;
  }

  mod.TimelineRenderer.prototype =
  {
    bar_height: 20,

    NeverExecuted: {},

    render: function(dataset)
    {
      // Create the chart container
      var target = $('<div class="bar-chart"></div>')
        .appendTo(this.target);

      // The data to plot for each node (planned vs. executed)
      var data;
      if (dataset === 'executed') {
        data = function(n) { return n.executed; };
      } else {
        data = function(n) { return n.planned; };
      }

      // Calculate width and scale of the plot
      var root_node = this.node;
      var tot_height_px = mod.countNodes(root_node) * this.bar_height;
      var tot_width = data(root_node).end; // in data unit
      if (!tot_width) throw "no plan time found";
      var tot_width_px = target.innerWidth();
      var scale_x = tot_width_px / tot_width;

      // Plot the bars
      var bar_height = this.bar_height;
      var height = mod.walkDepthFirst(root_node, 0, function(node, y) {

        if (null === data(node)) { return y; } // never exec'd node
        var bar_left = (data(node).start * scale_x);
        var bar_width = ((data(node).end - data(node).start) * scale_x);
        if (bar_width < 1) { bar_width = 1; }

        var bar = $('<div class="bar"></div>').css({
          left: (data(node).start * scale_x) + "px",
          width: bar_width + "px",
          top: (y + 2) + "px",
          height: (bar_height - 4) + "px",
        }).appendTo(target);

        // Find the best point to put the label (on, before, after the bar)
        var label = $('<span class="label"></span>').text(node.label);
        var label_ctr;
        if ((data(node).end - data(node).start) > 0.4 * tot_width) {
          label_ctr = bar;
        } else if (data(node).end < 0.5 * tot_width) {
          label_ctr = $('<div class="label-ctr"></div>').css({
            left: (bar_left + bar_width) + "px",
            top: (y + 2) + "px",
            height: bar_height + "px",
          }).appendTo(target);
        } else {
          label_ctr = $('<div class="label-ctr"></div>').css({
            left: 0,
            width: bar_left + "px",
            top: (y + 2) + "px",
            height: bar_height + "px",
          }).appendTo(target);
        }
        label_ctr.append(label);

        // Store the key points where to draw lines
        data(node)['start_point'] = [bar_left, y + 0.5 * bar_height];
        data(node)['end_point'] = [bar_left + bar_width, y + 0.5 * bar_height];

        return y + bar_height;
      });

      // Fit the chart height to the bars
      target.css("height", height);

      // Create the svg overlay
      var svg = $('<div class="svg"></div>')
        .appendTo(target)
        .width(this.target.outerWidth())
        .height(height);
      var xoff = -parseInt(svg.css("left")); // assume px

      svg.svg({onLoad: function (svg) {
        mod.walkDepthFirst(root_node, null, function(node, y) {
          if (null === data(node)) { return; } // never exec'd node
          $.each(node.children, function (i, child)
          {
            if (null === data(child)) { return; }
            // Check if the child is sequential or parallel to the parent
            var start_point, color;
            if (data(node).start < data(child).end) {
              start_point = data(child).start_point;
              color = '#0c0';
            } else {
              start_point = data(child).end_point;
              color = '#c00';
            }
            var end_point = data(node).start_point;
            svg.path(svg.createPath()
              .move(
                xoff + start_point[0], start_point[1])
              .curveC(
                xoff + start_point[0] + 40, start_point[1],
                xoff + end_point[0] - 40, end_point[1],
                xoff + end_point[0], end_point[1] + i * 4 - 2),
              {fill: 'none', stroke: color, strokeWidth: 3});
          });
        });
      }});
    },
  }

  mod.lstrip = function(s)
  {
    return s.replace(/^\s*/, "");
  }

  mod.walkDepthFirst = function(tree, acc, f)
  {
    $.each(tree.children, function (i, child) {
      acc = mod.walkDepthFirst(child, acc, f);
    });
    return f(tree, acc);
  }

  mod.countNodes = function(tree)
  {
    return mod.walkDepthFirst(tree, 0, function(t, acc) { return acc + 1 });
  }

})(planview);

