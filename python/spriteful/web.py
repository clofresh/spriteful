import json
import os
from glob import glob
from urllib import urlencode

from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop, PeriodicCallback
from tornado.web import RequestHandler, Application, URLSpec, HTTPError
from tornado.websocket import WebSocketHandler

from . import entity as entityModule
from .io import World, Publisher

url_namespace = 'spriteful'

class ClientHandler(RequestHandler):
    def get(self):
        self.render('index.html')
        
class CssSpritefulHandler(RequestHandler):
    def get(self):
        board_selector = self.get_argument('board_id')
        
        world_data = World.instance().to_dict()
        board_width = world_data['board']['tile_width'] * world_data['board']['cols']
        board_height = world_data['board']['tile_height'] * world_data['board']['rows']
        tile_class = world_data['tile_class']
        tile_width = world_data['board']['tile_width']
        tile_height = world_data['board']['tile_height']
        sprite_class = world_data['sprite_class']
        
        self.render('spriteful.css', 
            board_selector=board_selector,
            board_width=board_width,
            board_height=board_height,
            tile_class=tile_class,
            tile_width=tile_width,
            tile_height=tile_height,
            sprite_class=sprite_class
        )

class CssSpritesHandler(RequestHandler):
    def get(self):
        global url_namespace
        
        sprites = []
        for full_filename in glob('static/img/sprites/*.gif'):
            filename = os.path.basename(full_filename)
            
            type, animation, dimensions, extention = filename.split('.')
            width, height, frames = dimensions.split('-')
            url = '/%s/%s' % (url_namespace, full_filename)
            
            sprites.append((
                type,
                animation,
                int(width),
                int(height),
                int(frames),
                url
            ))
            
        self.render('sprites.css', sprites=sprites)

class WorldHandler(RequestHandler):
    def get(self):
        world = World.instance()
        self.write(world.to_dict())

class EntityHandler(RequestHandler):
    ''' CRUD Entities in the world
    '''
    
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
        args = {}
        for key, vals in self.request.arguments.items():
            if len(vals) == 1:
                args[str(key)] = vals[0]
            else:
                args[str(key)] = vals
                
        e = entity_class.default(**args)
        id = world.add(e)
        self.set_cookie('player_selector', '#%s' % id)
        self.redirect('%s?%s' % (
            self.reverse_url('Entity'),
            urlencode({'id': id})
        ))
    
    def delete(self):
        world = World.instance()
        id = self.get_argument('id')
        try:
            world.remove(id)
        except KeyError:
            raise HTTPError(404)

class GameConnection(WebSocketHandler):
    ''' Allows clients to subscribe to changes in the world via WebSocket
    '''
    
    def open(self):
        publisher = Publisher.instance()
        publisher.subscribe(self)
        self.write_message(publisher.world.to_dict())

    def on_message(self, message):
        data = json.loads(message)
        
        world = World.instance()
        world.select(data['selector']).receive(data)

    def on_close(self):
        publisher = Publisher.instance()
        publisher.unsubscribe(self)

def main():
    global url_namespace
    
    settings = {
        'static_path':       'static',
        'static_url_prefix': '/%s/static/' % url_namespace,
        'template_path':     'template',
        'debug':             True
    }
    
    url_mappings = [
        ('/', ClientHandler, 'Client'),
        ('/world', WorldHandler, 'World'),
        ('/entity', EntityHandler, 'Entity'),
        ('/connect', GameConnection, 'Connection'),
        ('/css/spriteful.css', CssSpritefulHandler, 'SpritefulStylesheet'),
        ('/css/sprites.css', CssSpritesHandler, 'SpritesStylesheet'),
    ]
    
    urls = [URLSpec('/%s%s' % (url_namespace, url), handler, name=name)
            for url, handler, name in url_mappings]

    application = Application(urls, **settings)
    
    http_server = HTTPServer(application)
    http_server.listen(8888)

    PeriodicCallback(World.instance(), callback_time=100).start()
    PeriodicCallback(Publisher.instance(), callback_time=100).start()

    IOLoop.instance().start()
