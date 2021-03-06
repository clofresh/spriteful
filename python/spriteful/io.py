from pprint import pprint
from random import randint

from .entity import Pc, Npc
from .util import Position

class World(object):
    ''' Singleton that manages all the entities in the game, tracking any 
        changes that need to be broadcast to subscribers.
    '''
    
    world = None
    rows = 40
    cols = 40
    
    @classmethod
    def instance(cls):
        if cls.world is None:
            world = cls(cls.rows, cls.cols)
            for i in range(3):
                world.add(Npc.default(*world.random_position()))
            cls.world = world
        
        return cls.world
    
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols
        self.entities = {}
        self.id_sequence = 1
        self.changed = []
    
    def __getitem__(self, key):
        return self.entities[key]
    
    def select(self, selector):
        entities = []
        if selector[0] == '#':
            try:
                entities = [self.entities[selector[1:]]]
            except KeyError:
                pass
        elif selector[0] == '.':
            selected_class = selector[1:]
            for entity in self.entities.values():
                if entity.has_class(selected_class):
                    entities.append(entity)
                
        return EntityMonad(entities)
    
    def intersect(self, rectangle):
        return [entity for entity in self.entities.values()
                if entity.position in rectangle]
    
    def _new_entity_message(self, entity):
        message = entity.to_dict()
        message['type'] = 'new'
        message['selector'] = '#cell-%s-%s' % message['position']
        self.changed.append(message)
    
    def add(self, entity):
        new_id = self.id_sequence
        entity.set_id(new_id)
        self.entities[entity.id] = entity
        self.id_sequence += 1
        self._new_entity_message(entity)
        return entity.id
    
    def remove(self, id):
        del self.entities[id]
    
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


class EntityMonad(object):
    ''' jQuery-like monadic wrapper around a list
    '''
    
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


class Publisher(object):
    ''' Singleton that takes the changes in the World object and publishes
        them to all the subscribers.
    '''
    
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

