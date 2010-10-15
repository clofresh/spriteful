import functools
import json
from collections import namedtuple
from glob import glob
from pprint import pprint
from random import randint

from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop, PeriodicCallback
from tornado.web import RequestHandler, Application, URLSpec, HTTPError
from tornado.websocket import WebSocketHandler

class Position(namedtuple('Position', 'x y')):
    def __repr__(self):
        return '(%s, %s)' % (self.x, self.y)
    
class World(object):
    world = None
    rows = 40
    cols = 40
    
    @classmethod
    def instance(cls):
        if cls.world is None:
            world = cls(cls.rows, cls.cols)
            for i in range(5):
                world.add(Npc.default(world.random_position()))
            world.add(Pc.default(world.random_position()))
            cls.world = world
        
        return cls.world
    
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols
        self.entities = {}
        self.id_sequence = 1
        self.changed = []
    
    def __getitem__(self, key):
        entities = []
        if key[0] == '#':
            try:
                entities = [self.entities[key[1:]]]
            except KeyError:
                pass
        elif key[0] == '.':
            selected_class = key[1:]
            for entity in self.entities.values():
                if entity.has_class(selected_class):
                    entities.append(entity)
                
        return EntityMonad(entities)
    
    def add(self, entity):
        new_id = self.id_sequence
        entity.set_id(new_id)
        self.entities[entity.id] = entity
        self.id_sequence += 1
        message = entity.to_dict()
        message['type'] = 'new'
        message['selector'] = '#cell-%s-%s' % message['position']
        self.changed.append(message)
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
                self.changed.extend(entity.changes())
    
    def changes(self):
        changed = self.changed
        self.changed = []
        return changed
    
    def random_position(self):
        return Position(randint(0, self.rows - 1), randint(0, self.cols - 1))

def find_path(start, end, path=[]):
    new_path = path
    if start == end:
        new_path.append(end)
        return new_path
    else:
        step = [0, 0]
        if end.x > start.x:
            step[0] += 1
        elif end.x < start.x:
            step[0] -= 1
        if end.y > start.y:
            step[1] += 1
        elif end.y < start.y:
            step[1] -= 1
            
        next = Position(start.x + step[0], start.y + step[1])
        new_path.append(next)
        
        return find_path(next, end, new_path);

class EntityMonad(object):
    def __init__(self, entities=[]):
        self.entities = entities
    
    def __getattr__(self, name):
        def f(*args, **kwargs):
            for entity in self.entities:
                method = getattr(entity, name, None)
                if method:
                    method(*args, **kwargs)
            return self
        return f

class Entity(object):
    main_class = None
    other_classes = []
    starting_sprite = None
    
    @staticmethod
    def get_sprites(main_class):
        sprites = {}
        for sprite in glob('static/img/%s*' % main_class):
            _, sprite_type, _, _ = sprite.split('.')
            sprites[sprite_type] = '/' + sprite
        return sprites
    
    @classmethod
    def default(cls, position):
        return cls(
            position,
            cls.main_class,
            cls.other_classes,
            cls.starting_sprite
        )

    def __init__(self, position, main_class, other_classes, starting_sprite):
        self.position = position
        self.main_class = main_class
        self.other_classes = other_classes
        self.starting_sprite = starting_sprite
        self.sprites = self.get_sprites(main_class)

        self.id = None
        self.intentions = []
        self._changes = []
        

    def __repr__(self):
        return '%s(%s)' % (self.__class__.__name__, repr(self.position))

    def set_id(self, id_number):
        self.id = '%s-%d' % (self.main_class, id_number)

    def intent_move(self, target):
        if target != self.position:
            path = find_path(self.position, target, [])
            print path
            self.intentions = [
                functools.partial(self.__class__.move, self, p)
                for p in path
            ]
    
    def move(self, position):
        self.position = position
        self._changes.append({
            'selector': "#%s" % self.id,
            'type': 'move', 
            'position': tuple(position)
        })
    
    def to_dict(self):
        return {
            'selector':"#%s" % self.id,
            'id': self.id,
            'position': self.position,
            'main_class': self.main_class,
            'other_classes': self.other_classes,
            'starting_sprite': self.starting_sprite,
            'sprites': self.sprites,
        }
    
    @property
    def changed(self):
        return len(self._changes) > 0
    
    def changes(self):
        output = self._changes
        self._changes = []
        
        return output
    
    def has_class(self, selected_class):
        return selected_class in set([self.main_class]).union(self.other_classes)
    
    def update(self, world):
        if len(self.intentions) > 0:
            intent = self.intentions[0]
            intent()
            self.intentions = self.intentions[1:]
    
    def receive(self, message):
        print '%s received %s' % (self.id, repr(message))

class Pc(Entity):
    main_class = 'monkey'
    other_classes = ['facing-left', 'player']
    starting_sprite = 'walk'
    
    def receive(self, message):
        super(self.__class__, self).receive(message)

        if message[u'type'] == u'move':
            self.intent_move(Position(*message['position']))
    
class Npc(Entity):
    main_class = 'large-monkey'
    other_classes = ['facing-left']
    starting_sprite = 'walk'
    
    def update(self, world):
        if not self.intentions:
            self.intent_move(world.random_position())
        else:
            super(self.__class__, self).update(world)
    

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
            print 'Changes: ',
            pprint(changes)
            for subscriber in self.subscribers:
                subscriber.write_message({"changes": changes})

class WorldHandler(RequestHandler):
    def get(self):
        world = World.instance()
        self.write(world.to_dict())

class EntityHandler(RequestHandler):
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
        
        entity_type = self.get_argument('type')
        x = int(self.get_argument('x'))
        y = int(self.get_argument('y'))
        
        entity_class = eval(entity_type)
        npc = entity_class.default(Position(x, y))
        id = world.add(npc)
        
        self.redirect(self.reverse_url('Entity', id=id))
    
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
        data = json.loads(message)
        
        world = World.instance()
        world[data['selector']].receive(data)

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
        URLSpec(r'/entity', EntityHandler, name='Entity'),
        URLSpec(r'/connect', GameConnection, name='Connection'),
    ]

    application = Application(urls, **settings)
    
    http_server = HTTPServer(application)
    http_server.listen(8888)

    PeriodicCallback(World.instance(), callback_time=100).start()
    PeriodicCallback(Publisher.instance(), callback_time=100).start()

    IOLoop.instance().start()

if __name__ == '__main__':
    main()

