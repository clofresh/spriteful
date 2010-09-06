function find_path(start, end, path) {
  // Eventually implement this as A*

  console.log(_.template('Finding path from (<%= start.row %>, <%= start.col %>) to (<%= end.row %>,<%= end.col %>)', 
    {
      start: start,
      end: end
    }
  ));
  
  var equals = function(a, b) { return (a.row == b.row && a.col == b.col) };
  var new_path = path;
  
  if (equals(start, end)) {
    new_path.push(end);
    return path;
  } else {
    var step;
    if (end.row > start.row) {
      step = {row: 1, col: 0};
    } else if (end.row < start.row) {
      step = {row: -1, col: 0};
    } else if (end.col > start.col) {
      step = {row: 0, col: 1};
    } else if (end.col < start.col) {
      step = {row:0, col: -1};
    }
    
    next = {
      row: start.row + step.row,
      col: start.col + step.col
    };
    
    new_path.push(start);
    
    return find_path(next, end, new_path);
  }
}

(function($) {
  $.fn.pathTo = function(end_selector) {
    $dest = $(end_selector);
    
    var start = {
      row: this.data('row'),
      col: this.data('col'),
    };
    
    var end = {
      row: $dest.data('row'),
      col: $dest.data('col')
    }
  
    var path = find_path(start, end, []);
    
    return $(_(path).map(function(o) {
      var sel = _.template('.tile.row-<%= row %>.col-<%= col %>', o);
      return $(sel);
    }));        
  };
})(jQuery);

function init_clock(beat_interval) {
  var heartbeat = function() {
    $('.actor').trigger('g:heartbeat');
    window.setTimeout(heartbeat, beat_interval);
  };
  
  window.setTimeout(heartbeat, beat_interval);
}
