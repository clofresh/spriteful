import json

from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop, PeriodicCallback
from tornado.web import RequestHandler, Application, URLSpec, HTTPError
from tornado.websocket import WebSocketHandler

from . import entity as entityModule
from .io import World, Publisher
from .util import Position

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
        
        entity_class = getattr(entityModule, entity_type)
        e = entity_class.default(Position(x, y))
        id = world.add(e)
        
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
