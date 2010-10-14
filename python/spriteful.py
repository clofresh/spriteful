from random import randint

from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop, PeriodicCallback
from tornado.web import RequestHandler, Application, URLSpec, HTTPError
from tornado.websocket import WebSocketHandler

class World(object):
    world = None
    rows = 40
    cols = 40
    
    @classmethod
    def instance(cls):
        if cls.world is None:
            cls.world = cls(cls.rows, cls.cols)
        
        return cls.world
    
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols
        self.entities = {}
        self.id_sequence = 1
        self.changed = []
    
    def add(self, entity):
        new_id = self.id_sequence
        entity.set_id(new_id)
        self.entities[entity.id] = entity
        self.id_sequence += 1
        self.changed.append(entity.to_dict())
        return entity.id
    
    def to_dict(self):
        return dict(
            type='world',
            heartbeat_interval=50,
            board=dict(
                tile_width=10,
                tile_height=10,
                rows=self.rows,
                cols=self.cols,
            ),
            tile_class='tile',
            player_id='player',
            actor_class='actor',
            sprite_class='sprite',
            entities=dict([(id, e.to_dict()) for id, e 
                            in self.entities.items()])
        )
    
    def __call__(self):
        world = World.instance()
        for id, entity in self.entities.items():
            entity.update(world)
            if entity.changed:
                self.changed.append(entity.to_dict())
                entity.changed = False
    
    def changes(self):
        changed = self.changed
        self.changed = []
        return changed

class Npc(object):
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.changed = False
        self.id = None
        self.main_class = 'large-monkey'
        self.other_classes = ['facing-left']
        self.starting_sprite = 'walk'
        self.sprites = {
            'walk': '/static/img/large-monkey.walk.52-28-4.gif'
        }
    
    def set_id(self, id_number):
        self.id = 'large-monkey-%d' % id_number
    
    def __repr__(self):
        return 'Npc(%s, %s)' % (self.x, self.y)
    
    def to_dict(self):
        return self.__dict__
    
    def update(self, world):
        old = (self.x, self.y)
        self.x = (self.x + randint(-1, 1)) % world.cols
        self.y = (self.y + randint(-1, 1)) % world.rows
        
        self.changed = (old != (self.x, self.y))


class Publisher(object):
    publisher = None
    
    @classmethod
    def instance(cls):
        if cls.publisher is None:
            cls.publisher = cls(World.instance())
        
        return cls.publisher
    
    def __init__(self, world):
        self.subscribers = set()
        self.world = world
    
    def subscribe(self, subscriber):
        self.subscribers.add(subscriber)
    
    def unsubscribe(self, subscriber):
        self.subscribers.remove(subscriber)
    
    def __call__(self):
        world = World.instance()
        changes = world.changes()
        if changes:
            print 'Changes: %s' % repr(changes)
            for subscriber in self.subscribers:
                subscriber.write_message({"changes": changes})

class WorldHandler(RequestHandler):
    def get(self):
        world = World.instance()
        self.write(world.to_dict())

class NpcHandler(RequestHandler):
    def get(self):
        world = World.instance()
        id = self.get_argument('id')
        try:
            entity = world.entities[id]
        except KeyError:
            raise HTTPError(404)
        else:
            self.write(entity.to_dict())
    
    def post(self):
        world = World.instance()
        
        x = int(self.get_argument('x'))
        y = int(self.get_argument('y'))
        
        npc = Npc(x, y)
        id = world.add(npc)
        
        self.redirect('%s?id=%s' % (self.reverse_url('Npc'), id))
    
    def delete(self):
        world = World.instance()
        id = self.get_argument('id')
        try:
            del world.entities[id]
        except KeyError:
            raise HTTPError(404)

class GameConnection(WebSocketHandler):
    def open(self):
        publisher = Publisher.instance()
        publisher.subscribe(self)
        self.write_message(publisher.world.to_dict())

    def on_message(self, message):
        self.write_message(u"You said: " + message)

    def on_close(self):
        publisher = Publisher.instance()
        publisher.unsubscribe(self)

def main():
    settings = {
        'static_path':   'static',
        'debug':         True
    }

    urls = [
        URLSpec(r'/world', WorldHandler, name='World'),
        URLSpec(r'/npc', NpcHandler, name='Npc'),
        URLSpec(r'/connect', GameConnection, name='Connection'),
    ]

    application = Application(urls, **settings)
    
    http_server = HTTPServer(application)
    http_server.listen(8888)

    io = IOLoop.instance()

    PeriodicCallback(World.instance(), callback_time=500).start()
    PeriodicCallback(Publisher.instance(), callback_time=500).start()

    io.start()

if __name__ == '__main__':
    main()

