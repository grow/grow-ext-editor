"""Screeting utility for the editor."""

from __future__ import print_function
import os
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


DEFAULT_SCREENSHOT_DIR = '/static/img/_screenshot'
ENV_DRIVER_PATH = 'CHROMEDRIVER_PATH'
WAIT_TIMEOUT = 10


class EditorScreenshot:
    """Editor screenshotting service."""

    def __init__(self, driver_path):
        self.driver_path = driver_path or '/usr/local/bin/chromedriver'
        self._drivers = {}

    def _driver_for_resolution(self, resolution):
        """Create or retrieve driver for a specific resolution."""
        if resolution not in self._drivers:
            chrome_options = Options()
            chrome_options.headless = True
            chrome_options.add_argument(resolution.chrome_argument)

            self._drivers[resolution] = webdriver.Chrome(
                self.driver_path, chrome_options=chrome_options)

        return self._drivers[resolution]

    def quit(self):
        for driver in self._drivers:
            driver.quit()
            del self._drivers[driver]

    def screenshot(self, url, resolutions):
        """Given a url, screenshot and save to the corresponding filename."""
        screenshots = {}

        for resolution in resolutions:
            driver = self._driver_for_resolution(resolution)
            driver.get(url)

            def _check_for_loaded(driver):
                return driver.execute_script('return document.readyState;') == 'complete'

            wait = WebDriverWait(driver, WAIT_TIMEOUT)
            wait.until(_check_for_loaded)

            screenshots[resolution] = driver.get_screenshot_as_png()

        return screenshots


class ScreenshotResolution:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def chrome_argument(self):
        return '--window-size={},{}'.format(self.width, self.height)

    @property
    def resolution(self):
        return '{}x{}'.format(self.width, self.height)

    def filename(self, base):
        return '{}-{}x{}.png'.format(base, self.width, self.height)
