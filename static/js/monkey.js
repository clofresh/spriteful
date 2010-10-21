var monkey = {
  init: function() {
    $("#content").spriteful(function(config) {
      var actor_selector = '.' + config.actor_class;
      $(this)
        .delegate('.' + config.tile_class, 'click', function() {
          $.player().intentMove($(this));
        })
        .delegate(actor_selector, 'spriteful:bite', function(evt, message) {
          $(this).bite();
        })
        .delegate(actor_selector, 'spriteful:move', function(evt, message) {
          var $target = $(this);
          var dest = $(_.template("#cell-<%= x %>-<%= y %>", {
            x: message.position[0], 
            y: message.position[1]
          }));
          $target.intentions([function() { $target.move(dest) }]);
        })
        .delegate(actor_selector, 'spriteful:bitten', function(evt, message) {
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
      
                 
      $('.' + config.tile_class).addClass('grass');
    
    });
        
    $(document).keypress(function(event) {
      if (event.which == 32) {
       $.player().intentBite();
       event.preventDefault();
      }
    });    
  }
};


(function($) {
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
  
})(jQuery);

jQuery.player_selector = function() {
  return $.cookie('player_selector');
};

jQuery.player = function() {
  return $($.player_selector());
}

