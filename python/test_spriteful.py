from unittest import TestCase, main
from spriteful import EntityMonad

class TestEntityMonad(TestCase):
    def setUp(self):
        self.case1 = EntityMonad()
        self.case2 = EntityMonad([[2, 3, 1]])
        self.case3 = EntityMonad([[2, 3, 1], [1], [4, 1, 7]])
        self.case4 = EntityMonad(['mixed', (1, 2), [2, 3, 1]])
    
    def testChaining(self):
        self.assertEquals(self.case1.doThis().doThat(), self.case1)
        self.assertEquals(self.case2.doThis().doThat(), self.case2)
        self.assertEquals(self.case3.doThis().doThat(), self.case3)
        self.assertEquals(self.case4.doThis().doThat(), self.case4)
    
    def testImplicitIteration(self):
        self.case2.sort(reverse=True)
        self.assertEquals(self.case2.entities, [[3, 2, 1]])
        
        self.case3.sort(reverse=True)
        self.assertEquals(self.case3.entities, [[3, 2, 1], [1], [7, 4, 1]])
        
        self.case4.sort(reverse=True)
        self.assertEquals(self.case4.entities, ['mixed', (1, 2), [3, 2, 1]])

if __name__ == '__main__':
    main()

