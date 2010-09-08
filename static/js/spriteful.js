console.log = function() {};

var spriteful = {
  loaded_sprites: {},
  
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
      var step = {row:0, col: 0};
      if (end.row > start.row)      { step.row += 1 } 
      else if (end.row < start.row) { step.row -= 1 }
      if (end.col > start.col)      { step.col += 1 }
      else if (end.col < start.col) { step.col -= 1 }

      next = {
        row: start.row + step.row,
        col: start.col + step.col
      };
    
      new_path.push(start);
    
      return spriteful.find_path(next, end, new_path);
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

    var cloned = $this.detach();

    $(cloned)
      .data('row',        node.data('row'))
      .data('col',        node.data('col'));
    
    $(node).append(cloned);
    
  },
  
  parse_sprite_image: function(img_url) {
    var parsed = $.url.setUrl(img_url).attr("file").split('.');
    var dimensions = parsed[2].split('-');
    var sprite = {
      type: parsed[0],
      animation: parsed[1],
      width: dimensions[0],
      height: dimensions[1],
      frames: dimensions[2],
      url: img_url,
      num: 0
    };
    
    var key = [sprite.type, sprite.animation].join('.');
    if (!spriteful.loaded_sprites[key]) {
      $(_.template(spriteful.templates.sprite_css, sprite)).appendTo('head');
      spriteful.loaded_sprites[key] = true;
    }
    return sprite;
  },

  templates: {
    'sprite_css': [
      "<style>",
      ".<%= type %> {",
      "  background-image: url(<%= url %>);",
      "  background-repeat: no-repeat;",
      "  width: <%= width %>px;",
      "  height: <%= height %>px;",
      "}",
      "<% _.each(_.range(frames), function(i) { %>",
      "  .<%= type %>.<%= animation %>-<%= i %> { background-position: <%= -1 * i * width %>px 0px }",
      " <% }); %>",
      "</style>"
    ].join("\n")
  }
};




(function($) {
  $.fn.spriteful = function(config) {
    $(this).data('config', config)
           .addClass('_controller')
           .initTiles(config)
           .initClock('.' + config.actor_class, config.heartbeat_interval);
  };
  
  $.fn.spritefulConfig = function() {
    return $(this).parents('._controller').data('config');
  }
  
  $.fn.placeSprite = function(options) {
    //id, classes, sprite_options
    var $this = $(this);
    var config = $this.spritefulConfig();
    var classes = options.other_classes;
    classes.push(options.main_class);
    classes.push(config.actor_class);
    classes.push(config.sprite_class);
    classes.push(options.starting_sprite + '-0');
    
    var sprite_html = _.template('<div id="<%= id %>" class="<%= classes %>"></div>', {
      id: options.id,
      classes: classes.join(" ")
    });
    var el = $(sprite_html);

    $this.append(el);
    
    var sprite_options = spriteful.parse_sprite_image(options.sprites[options.starting_sprite]);
    $('#' + options.id)
      .data('animation', sprite_options)
      .data('row', $this.data('row'))
      .data('col', $this.data('col'))
      .data('move_func', spriteful.move_action)
      .data('sprites', options.sprites);
      
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
  
    var path = spriteful.find_path(start, end, []);
    var config = $this.spritefulConfig();
    
    return $(_(path).map(function(o) {
      o._tile_class = config.tile_class;
      var sel = _.template('.<%= _tile_class %>.row-<%= row %>.col-<%= col %>', o);
      return $(sel);
    }));        
  };
  
  $.fn.moveTo = function(end_selector) {
    return $(this).each(function() {
      var $this = $(this);
      var move_func = $this.data('move_func');
      var intentions = _($this.pathTo(end_selector)).map(function(node) {
        return function() { move_func($this, node) };
      });
      $this.data('intentions', intentions);
    })
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
    var old_class = [old_animation.animation, old_animation.num].join('-');

    var new_animation = old_animation;
    new_animation.num = (new_animation.num + 1) % new_animation.frames;
    var new_class = [new_animation.animation, new_animation.num].join('-');
    
    $this.removeClass(old_class).addClass(new_class).data('animation', new_animation);
  }
  
  $.fn.initTiles = function(config) {
    var tile_class = config.tile_class;
    var sprite_class = config.sprite_class;
    var board = config.board;
    
    var getRowNum = function(i, total_cols) {
      return Math.floor(i / total_cols);
    };
    var getColNum = function(i, total_cols) {
      return Math.floor(i % total_cols);
    }
    
    var tile_count = board.rows * board.cols;
    
    $(_.template(
      ["<style>",
       "<%= board_selector %> { ",
       "  width: <%= board_width %>px;",
       "  height: <%= board_height %>px;",
       /*  rotate(-45deg) skew(15deg, 15deg) */
       "  -webkit-transform: matrix(0.95, -0.57, 0.90, 0.52, 0, 0);", 
       "  -moz-transform: matrix(0.95, -0.57, 0.90, 0.52, 0, 0);",
       "  transform: matrix(0.95, -0.57, 0.90, 0.52, 0, 0);", 
       "  margin-left: auto;",
       "  margin-right: auto;",
       "}",
       ".<%= tile_class %> {",
       "  width: <%= tile_width %>px;",
       "  height: <%= tile_height %>px;",
       "  display: block;",
       "  float: left;",
       "  padding:0px;",
       "  margin:0px;",
       "}",
       ".<%= sprite_class %>.facing-right {",
       /* The inverse matrix of the viewport transformation */
       "  -webkit-transform: matrix(0.52, 0.57, -0.90, 0.95, 0, 0);",
       "  -moz-transform: matrix(0.52, 0.57, -0.90, 0.95, 0, 0);",  
       "  transform: matrix(0.52, 0.57, -0.90, 0.95, 0, 0);" ,
       "}",
       ".<%= sprite_class %>.facing-left {",
       /* The inverse matrix of the viewport transformation, reflected over the y axis */
       "  -webkit-transform: matrix(-0.52, -0.57, -0.90, 0.95, 0, 0);",  
       "  -moz-transform: matrix(-0.52, -0.57, -0.90, 0.95, 0, 0);",  
       "  transform: matrix(-0.52, -0.57, -0.90, 0.95, 0, 0);",  
       "}",
       "</style>"].join("\n"), {
      board_selector: $(this).selector,
      board_width: board.tile_width * board.cols,
      board_height: board.tile_height * board.rows,
      tile_class: tile_class,
      tile_width: board.tile_width,
      tile_height: board.tile_height,
      sprite_class: sprite_class
    })).appendTo('head');
    
    var tiles = _.range(tile_count).map(function(i) {
      var coordinates = {
        row: getRowNum(i, board.cols), 
        col: getColNum(i, board.cols),
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
      $this.find(actor_selector).trigger('g:heartbeat');
      window.setTimeout(heartbeat, beat_interval);
    };
  
    window.setTimeout(heartbeat, beat_interval);
    $this.find(actor_selector).live('g:heartbeat', function() {
      var intentions = $(this).data('intentions');
    
      if (!_.isEmpty(intentions)) {
        var next = _(intentions).first();
        $(this).data('intentions', _(intentions).slice(1, intentions.length));
        console.log('#' + $(this).attr('id') + ' has ' + (intentions.length - 1) + ' intentions left');
        next();
      } else {
        $(this).trigger('g:idle');
      }
    });

    return $(this);
  };
  
})(jQuery);


