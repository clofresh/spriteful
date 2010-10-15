import functools
from ..util import Position, Dimensions, Rectangle

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
    

class Behavior(object):
    pass

class CanMove(Behavior):
    def intent_move(self, target):
        if target != self.position:
            path = find_path(self.position, target, [])
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
