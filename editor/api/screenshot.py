"""Screenshotting utility for the editor."""

DEFAULT_SCREENSHOT_DIR = '/static/img/_screenshot'
WAIT_TIMEOUT = 10

class ScreenshotResolution:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def resolution(self):
        return '{}x{}'.format(self.width, self.height)

    def filename(self, base):
        return '{}-{}x{}.png'.format(base, self.width, self.height)
