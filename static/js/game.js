var game = {
  find_path: function(start, end, path) {
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
    
      return game.find_path(next, end, new_path);
    }
  },

  init_clock: function(beat_interval) {
    var heartbeat = function() {
      $('.actor').trigger('g:heartbeat');
      window.setTimeout(heartbeat, beat_interval);
    };
  
    window.setTimeout(heartbeat, beat_interval);
  },
  
  update_player_intentions: function() {
    $('#player').data('intentions', []);

    $this = $(this);
    
    var intentions = _($('#player').parent('.tile').pathTo(this)).map(function(n) {
      var $this = n;
      var adjust_facing = function() {
        var row = $this.data('row');
        var col = $this.data('col');
        var prev_row = $('#player').parent('.tile').data('row');
        var prev_col = $('#player').parent('.tile').data('col');
        
        if (col > prev_col || row > prev_row) {
          $('#player').removeClass('facing-left').addClass('facing-right');
        } else if (col < prev_col || row < prev_row) {
          $('#player').removeClass('facing-right').addClass('facing-left');
        }
      }
      
      var update_animation = function() {
        var old_animation = $('#player').data('animation')
        var old_class = [old_animation.sprite, old_animation.num].join('-');

        var new_animation = old_animation;
        new_animation.num = (new_animation.num + 1) % new_animation.total;
        var new_class = [new_animation.sprite, new_animation.num].join('-');
        
        $('#player').removeClass(old_class).addClass(new_class).data('animation', new_animation);
      }
      
      var move_player = function() {
        var player = $('#player').clone();
        $(player).data(
          'intentions', 
          $('#player').data('intentions')
        ).data(
          'animation',
          $('#player').data('animation')
        );
        $('#player').remove();
        $this.append(player);
      }
      
      return function() { 
        adjust_facing();
        update_animation();
        move_player();
      };
    });
    
    intentions.reverse();
    
    $('#player').data('intentions', intentions);
  }
};


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
  
    var path = game.find_path(start, end, []);
    
    return $(_(path).map(function(o) {
      var sel = _.template('.tile.row-<%= row %>.col-<%= col %>', o);
      return $(sel);
    }));        
  };
  
  $.fn.initTiles = function(board) {
    var getRowNum = function(i, tile_width) {
      return Math.floor(i / tile_width);
    };
    var getColNum = function(i, tile_width) {
      return Math.floor(i % tile_width);
    }
    
    var tiles = _.range(board.tile_count()).map(function(i) {
      var coordinates = {
        row: getRowNum(i, board.tile_width), 
        col: getColNum(i, board.tile_width)
      };
      
      return _.template('<div class="tile grass row-<%= row %> col-<%= col %>" id="cell-<%= row %>-<%= col %>"></div>', coordinates)
    }).join("");
    
    $(this).html(tiles);
  };
  
})(jQuery);


