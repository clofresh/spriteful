from collections import namedtuple

class Position(namedtuple('Position', 'x y')):
    def __repr__(self):
        return '(%s, %s)' % (self.x, self.y)

class Dimensions(namedtuple('Dimensions', 'w h')):
    def __repr__(self):
        return '(%s, %s)' % (self.w, self.h)

class Rectangle(namedtuple('Rectangle', 'position dimensions')):
    def __repr__(self):
        return '(%s, %s)' % (self.position, self.dimensions)
    
    def __contains__(self, position):
        return self.position.x <= position.x <= self.position.x + self.dimensions.w  \
                 and                                                                 \
               self.position.y <= position.y <= self.position.y + self.dimensions.h
    


