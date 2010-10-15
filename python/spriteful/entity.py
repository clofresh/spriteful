import functools
from glob import glob
from random import randint

from .util import Position, Dimensions, Rectangle

class Behavior(object):
    pass

class CanMove(Behavior):
    def intent_move(self, target):
        if target != self.position:
            path = find_path(self.position, target, [])
            print path
            self.intentions = [
                functools.partial(self.__class__.move, self, p)
                for p in path
            ]
    
    def move(self, position, world):
        self.position = position
        self._changes.append({
            'selector': "#%s" % self.id,
            'type': 'move', 
            'position': tuple(position)
        })
    
    def receive_move(self, message):
        self.intent_move(Position(*message['position']))
    
class CanBite(Behavior):
    def intent_bite(self):
        self.intentions.append(functools.partial(self.__class__.bite, self))
    
    def bite(self, world):
        collisions = [
            c for c in world.intersect(Rectangle(self.position, Dimensions(3, 3)))
            if c is not self
        ]
        
        self._changes.append({
            'selector': '#%s' % self.id,
            'type': 'bite'
        })
        
        for entity in collisions:
            self._changes.append({
                'selector': '#%s' % entity.id,
                'type': 'bitten'
            })
    
    def receive_bite(self, message):
        self.intent_bite()

class Entity(object):
    ''' Base class for any game object. 
    '''
    
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
        all_classes = set([self.main_class]).union(self.other_classes)
        return selected_class in all_classes
    
    def update(self, world):
        if len(self.intentions) > 0:
            intent = self.intentions[0]
            intent(world)
            self.intentions = self.intentions[1:]
    
    def receive(self, message):
        print '%s received %s' % (self.id, repr(message))
        
        method = getattr(self, 'receive_%s' % message[u'type'], None)
        if method:
            method(message)
        

class Pc(Entity, CanMove, CanBite):
    main_class = 'monkey'
    other_classes = ['facing-left', 'player']
    starting_sprite = 'walk'
    
class Npc(Entity, CanMove):
    main_class = 'large-monkey'
    other_classes = ['facing-left']
    starting_sprite = 'walk'
    
    def update(self, world):
        if not self.intentions:
            if randint(0, 100) == 1:
                self.intent_move(world.random_position())
        else:
            super(self.__class__, self).update(world)


def find_path(start, end, path=[]):
    ''' Recursive function that calculates the path between two Positions.
        Right now it assumes there are no obstructions. Once obstructions 
        are allowed, this should implement the A* algorithm.
    '''
    
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
    
