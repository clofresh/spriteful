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
    $('.actor').initHeartbeat();
  },
  
  update_player_intentions: function(tile_class, player_id) {
    $('#' + player_id).data('intentions', []);

    $this = $(this);
    
    var intentions = _($('#' + player_id).parent('.' + tile_class).pathTo(this)).map(function(n) {
      var $this = n;
      var adjust_facing = function() {
        var row = $this.data('row');
        var col = $this.data('col');
        var prev_row = $('#' + player_id).parent('.' + tile_class).data('row');
        var prev_col = $('#' + player_id).parent('.' + tile_class).data('col');
        
        if (col > prev_col || row > prev_row) {
          $('#' + player_id).removeClass('facing-left').addClass('facing-right');
        } else if (col < prev_col || row < prev_row) {
          $('#' + player_id).removeClass('facing-right').addClass('facing-left');
        }
      }
      
      var update_animation = function() {
        var old_animation = $('#' + player_id).data('animation')
        var old_class = [old_animation.sprite, old_animation.num].join('-');

        var new_animation = old_animation;
        new_animation.num = (new_animation.num + 1) % new_animation.total;
        var new_class = [new_animation.sprite, new_animation.num].join('-');
        
        $('#' + player_id).removeClass(old_class).addClass(new_class).data('animation', new_animation);
      }
      
      var move_player = function() {
        var player = $('#' + player_id).clone();
        $(player).data(
          'intentions', 
          $('#' + player_id).data('intentions')
        ).data(
          'animation',
          $('#' + player_id).data('animation')
        );
        $('#' + player_id).remove();
        $this.append(player);
      }
      
      return function() { 
        adjust_facing();
        update_animation();
        move_player();
      };
    });
    
    intentions.reverse();
    
    $('#' + player_id).data('intentions', intentions);
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
  
  $.fn.initTiles = function(tile_class, board) {
    var getRowNum = function(i, tile_width) {
      return Math.floor(i / tile_width);
    };
    var getColNum = function(i, tile_width) {
      return Math.floor(i % tile_width);
    }
    
    var tiles = _.range(board.tile_count()).map(function(i) {
      var coordinates = {
        row: getRowNum(i, board.tile_width), 
        col: getColNum(i, board.tile_width),
        tile_class: tile_class
      };
      
      return _.template('<div class="<%= tile_class %> row-<%= row %> col-<%= col %>" id="cell-<%= row %>-<%= col %>"></div>', coordinates)
    }).join("");
    
    $(this).html(tiles);

    $('.' + tile_class).each(function() {
      var $this = $(this);  
      if(!$this.data('row')) {
        var id_parts = $this.attr('id').split('-');
        $this.data('row', parseInt(id_parts[1])).data('col', parseInt(id_parts[2]));
      }
    });
    

  };
  
  $.fn.initHeartbeat = function() {
    $(this).live('g:heartbeat', function() {
      var intentions = $(this).data('intentions');
      
      if (!_.isEmpty(intentions)) {
        var next = _(intentions).last();
        next();
        _(intentions).pop();
        $(this).data('intentions', intentions);
      }
    });
  }
})(jQuery);


