var game = {
  find_path: function(start, end, path) {
    // Eventually implement this as A*

    /*
    console.log(_.template('Finding path from (<%= start.row %>, <%= start.col %>) to (<%= end.row %>,<%= end.col %>)', 
      {
        start: start,
        end: end
      }
    ));
    */
  
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
  
  move_action: function(ref, node) {
    var $this = $(ref);
    console.log(_.template('<%= id %> is moving to [<%= row %>, <%= col %>]', {
      id: $this.selector,
      row: node.data('row'),
      col: node.data('col')
    }));
    $this.orientTowards(node).advanceAnimation();

    var cloned = $this.clone();

    _($this.data()).each(function(val, key) {
      $(cloned).data(key, val);
    });
    
    $(cloned)
      .data('row',        node.data('row'))
      .data('col',        node.data('col'));
    $this.remove();
    
    $(node).append(cloned);
    
  }
};


(function($) {
  $.fn.game = function(config) {
    $(this).initTiles(config.tile_class, config.board)
           .initClock('.' + config.actor_class, config.heartbeat_interval);
  };
  
  $.fn.placeSprite = function(id, classes, sprite_options) {
    var $this = $(this);
    classes.push('actor');
    classes.push('sprite');
    classes.push(sprite_options.sprite + '-0');
    
    var sprite_html = _.template('<div id="<%= id %>" class="<%= classes %>"></div>', {
      id: id,
      classes: classes.join(" ")
    });
    var el = $(sprite_html);

    $this.append(el);
    $('#' + id)
      .data('animation', sprite_options)
      .data('row', $this.data('row'))
      .data('col', $this.data('col'))
      .data('move_func', game.move_action);
      
    return $this;
  }
  
  $.fn.pathTo = function(end_selector) {
    var $this = $(this);
    var $dest = $(end_selector);
    
    var start = {
      row: $this.data('row'),
      col: $this.data('col'),
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
  
  $.fn.moveTo = function(end_selector) {
    var $this = $(this);
    var move_func = $this.data('move_func');
    var intentions = _($this.pathTo(end_selector)).map(function(node) {
      return function() { move_func($($this.selector), node) };
    });
    $this.data('intentions', intentions);
    
    return $this;
  };
  
  $.fn.orientTowards = function(target_selector) {
    var $this = $(this);
    var $target = $(target_selector);
    
    var prev = {
      row: $this.data('row'),
      col: $this.data('col')
    }
    var row = $target.data('row');
    var col = $target.data('col');
                    
    if (col > prev.col || row > prev.row) {
      $this.removeClass('facing-left').addClass('facing-right');
    } else if (col < prev.col || row < prev.row) {
      $this.removeClass('facing-right').addClass('facing-left');
    }
    
    return $this;
  },
  
  $.fn.advanceAnimation = function() {
    var $this = $(this);
    var old_animation = $this.data('animation');
    var old_class = [old_animation.sprite, old_animation.num].join('-');

    var new_animation = old_animation;
    new_animation.num = (new_animation.num + 1) % new_animation.total;
    var new_class = [new_animation.sprite, new_animation.num].join('-');
    
    $this.removeClass(old_class).addClass(new_class).data('animation', new_animation);
  }
  
  $.fn.initTiles = function(tile_class, board) {
    var getRowNum = function(i, tile_width) {
      return Math.floor(i / tile_width);
    };
    var getColNum = function(i, tile_width) {
      return Math.floor(i % tile_width);
    }
    
    var tile_count = board.tile_width * board.tile_height;
    
    var tiles = _.range(tile_count).map(function(i) {
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
    
    return $(this);
  };

  $.fn.initClock = function(actor_selector, beat_interval) {
    var $this = $(this);
    var heartbeat = function() {
      $this.find('.to-remove').remove();
      $this.find(actor_selector).trigger('g:heartbeat');
      window.setTimeout(heartbeat, beat_interval);
    };
  
    window.setTimeout(heartbeat, beat_interval);
    $this.find(actor_selector).live('g:heartbeat', function() {
      var intentions = $(this).data('intentions');
    
      if (!_.isEmpty(intentions)) {
        var next = _(intentions).first();
        $(this).data('intentions', _(intentions).slice(1, intentions.length));
        console.log('#' + $(this).attr('id') + ' has ' + intentions.length + ' intentions left');
        next();
      }
    });

    return $(this);
  };
  
})(jQuery);


