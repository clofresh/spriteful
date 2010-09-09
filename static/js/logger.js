var logger = {
  verbosity: null,
  target: null,
  sampling_frequency: null,
  seq: 0,
  levels: {
    DEBUG: 10,
    INFO: 20,
    WARN: 30,
    ERROR: 40,
    CRITICAL: 50
  },

  targets: {
    console: function(level, msg, meta) {
      if(console && console.log) {
        console.log(msg);
      }
    },
    none: function(level, msg, meta) {}
  },
  
  log: function(level, msg, meta) {
    if (level >= this.verbosity) {
      if ((this.seq % this.sampling_frequency) == 0) {
        this.target(level, msg, meta);
      }
      this.seq += 1;
    }
  },
  
  
  debug:    function(msg, meta) { this.log(this.levels.DEBUG, msg, meta)    },
  info:     function(msg, meta) { this.log(this.levels.INFO, msg, meta)     },
  warn:     function(msg, meta) { this.log(this.levels.WARN, msg, meta)     },
  error:    function(msg, meta) { this.log(this.levels.ERROR, msg, meta)    },
  critical: function(msg, meta) { this.log(this.levels.CRITICAL, msg, meta) },


  configure: function(options) {
    if (options.verbosity) {
      this.verbosity = this.levels[options.verbosity.toUpperCase()];
    }
    
    if (options.target) {
      this.target = this.targets[options.target.toLowerCase()];
    }
    
    if (options.sampling_frequency) {
      this.sampling_frequency = options.sampling_frequency;
    }
    
    return this;
  },
}.configure({
  verbosity: 'info',
  target: 'console',
  sampling_frequency: 1
});

