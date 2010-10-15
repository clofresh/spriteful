var spriteful = {  
  loaded_sprites: {},
  
  connection: {
    _connection: null,

    send_message: function(message) {
      var str_message = JSON.stringify(message);
      logger.debug(str_message); 
      return this._connection.send(str_message);
    },
    
    connect: function(main_el, init_block) {
      this._connection = new WebSocket("ws://localhost:8888/connect");
    
      // The bind makes sure that "this" in the init function
      // refers to the websocket object, not the WebSocket object.
      // Wow, yeah that's confusing.
      this._connection.onmessage = _.bind(this.init, this, main_el, init_block); 
    
      return this._connection;
    },
  
    init: function(el, init_block, evt) {
      var config = JSON.parse(evt.data)
      logger.info("Initializing Spriteful: ");
      logger.info(config);
      
      $(el).data('config', config)
           .addClass('_controller')
           .initTiles(config)
           .initClock('.' + config.actor_class, config.heartbeat_interval)
           .delegate('.' + config.tile_class, 'spriteful:new', function(evt, message) {
             $(this).placeSprite(message);
           })
      
      _.bind(init_block, $(el))(config);
      
      _.each(config.entities, function(entity) {
        var dest = _.template("#cell-<%= x %>-<%= y %>", {
          x: entity.position[0], 
          y: entity.position[1]
        });
        $(dest).placeSprite(entity);
      });

      this._connection.onmessage = this.loop;
    },  

    loop: function(evt) {
      var changes = JSON.parse(evt.data).changes;
      _.each(changes, function(message) {
        var $target;
        if (message.selector) {
          $target = $(message.selector);
        } else {
          $target= $("#content");
        }
        $target.trigger('spriteful:' + message.type, message);
      })
    },    
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
      ".<%= type %>.<%= animation %> {",
      "  background-image: url(<%= url %>);",
      "  background-repeat: no-repeat;",
      "  width: <%= width %>px;",
      "  height: <%= height %>px;",
      "  position: relative;",
      "}",
      "<% _.each(_.range(frames), function(i) { %>",
      "  .<%= type %>.<%= animation %>.sprite-<%= i %> { background-position: <%= -1 * i * width %>px 0px }",
      " <% }); %>",
      "</style>"
    ].join("\n")
  }
};



(function($) {
  $.fn.spriteful = function(init_block) {
    spriteful.connection.connect(this, init_block);
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
    
    var animations = _.reduce(options.sprites, {}, function(memo, val, key) { 
      memo[key] = spriteful.parse_sprite_image(val);
      return memo;
    });
    
    var current_animation = animations[options.starting_sprite];
    $('#' + options.id)
      .data('animation', current_animation)
      .data('animations', animations)
      .data('row', $this.data('row'))
      .data('col', $this.data('col'))
      .data('sprites', options.sprites)
      .addClass(options.starting_sprite)
      .bind('spriteful:move', function(evt, message) {
        var $target = $(this);
        var dest = $(_.template("#cell-<%= x %>-<%= y %>", {
          x: message.position[0], 
          y: message.position[1]
        }));
        $target.intentions([function() { $target.move(dest) }]);
      })
      .bind('spriteful:bitten', function(evt, message) {
        var $this = $(this);
        $this.intentions([
          function() { 
            $this.css('left', '2px')
                 .css('top', '2px')
          },
          function() { 
            $this.css('left', '3px')
                 .css('top', '3px')
          },
          function() {
            $this.css('position', 'relative')
                 .css('left', '0px')
                 .css('top', '0px')
          },
        ]);        
      });
    
    return $this;
  }
  
  $.fn.intentMove = function(target_selector) {
    return $(this).each(function() {
      spriteful.connection.send_message({
        selector: '#' + $(this).attr('id'),
        type: 'move',
        position: [
          target_selector.data('row'), 
          target_selector.data('col')
        ]
      })
    })
  };
  
  $.fn.move = function(node) {
    $node = $(node);
    $(this).each(function() {
      var $this = $(this);
      logger.debug(_.template('#<%= id %> is moving to [<%= row %>, <%= col %>]', {
        id: $this.attr('id'),
        row: node.data('row'),
        col: node.data('col')
      }));
      $this.orientTowards(node).advanceAnimation();

      var cloned = $this.detach();

      $(cloned)
        .data('row',        node.data('row'))
        .data('col',        node.data('col'));
    
      $node.append(cloned);
    })
  };
  
  $.fn.animation = function(a) {
    $(this).each(function() {
      var $this = $(this);
      var old_animation = $this.data('animation');
      var new_animation = $this.data('animations')[a];
      new_animation.num = 0;
      $this.data('animation', new_animation);
      $this.removeClass(old_animation.animation)
           .removeClass(['sprite', old_animation.num].join('-'))
           .addClass(new_animation.animation)
           .addClass(['sprite', new_animation.num].join('-'));
      old_animation.num = 0;
    });
    
    return $(this);
  };
  
  $.fn.intentions = function(intentions) {
    $(this).each(function() {
      $(this).data('intentions', intentions);
    });
    
    return $(this);
  };
  
  $.fn.intentBite = function() {
    return $(this).each(function() {
      spriteful.connection.send_message({
        selector: '#' + $(this).attr('id'),
        type: 'bite'
      })
    })    
  };
  
  $.fn.bite = function() {
    $(this).each(function() {
      var $this = $(this);
      $this.animation('bite'); 
      if ($this.hasClass('facing-right')) {
        $this.intentions([
          function() { 
            $this.css('left', '2px')
                 .css('top', '2px')
                 .advanceAnimation()
          },
          function() { 
            $this.css('left', '3px')
                 .css('top', '3px')
                 .advanceAnimation() 
          },
          function() {
            $this.css('position', 'relative')
                 .css('left', '0px')
                 .css('top', '0px')
                 .animation('walk');
          },
        ]);
      } else {
        $this.intentions([
          function() { 
            $this.css('left', '-2px')
                 .css('top', '-2px')
                 .advanceAnimation()
          },
          function() { 
            $this.css('left', '-3px')
                 .css('top', '-3px')
                 .advanceAnimation() 
          },
          function() {
            $this.css('position', 'relative')
                 .css('left', '0px')
                 .css('top', '0px')
                 .animation('walk');
          },
        ]);
      }
    })
    return $(this);
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
    var old_class = ['sprite', old_animation.num].join('-');

    var new_animation = old_animation;
    new_animation.num = (new_animation.num + 1) % new_animation.frames;
    var new_class = ['sprite', new_animation.num].join('-');
    
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
        logger.debug('#' + $(this).attr('id') + ' has ' + (intentions.length - 1) + ' intentions left');
        next();
      } else {
        $(this).trigger('g:idle');
      }
    });

    return $(this);
  };
  
})(jQuery);


