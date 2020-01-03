"""Setup script for extension."""

from setuptools import setup


setup(
    name='grow-ext-editor',
    version='1.0.0',
    license='MIT',
    author='Grow Authors',
    author_email='hello@grow.io',
    include_package_data=True,
    packages=[
        'editor',
    ],
    package_data={
        'editor': ['dist/*.js', 'dist/*.css', 'dist/*.html']
    },
    install_requires=[
        'werkzeug',
    ],
)
