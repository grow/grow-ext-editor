"""Utility for working with yaml from the client."""

from __future__ import print_function
import datetime
import re
import yaml
from grow.common import utils


DATE_RE = re.compile(r'^[\d]{4}-[\d]{2}-[\d]{2}$')
DATETIME_RE = re.compile(r'^[\d]{4}-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}$')


def convert_fields(fields):
    """Convert raw field data from submission to use objects when needed."""

    def _walk_field(item, key, node, parent_node):
        # Convert dates.
        try:
            value = node[key]
            if DATETIME_RE.match(value):
                node[key] = datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M")
            elif DATE_RE.match(value):
                tempValue = datetime.datetime.strptime(value, "%Y-%m-%d")
                node[key] = datetime.date(tempValue.year, tempValue.month, tempValue.day)
        except:
            pass

        # Convert the !g constructors into their objects.
        if key == 'tag' and item.startswith('!g.') and 'value' in node:
            # If the value was removed, remove the constructor.
            if not node['value']:
                newValue = None
            else:
                newValue = ConstructorReference(item, node['value'])

            try:
                # Try as an array.
                for index, parent_key in enumerate(parent_node):
                    if parent_node[index] == node:
                        parent_node[index] = newValue
                        break
            except KeyError:
                # Try as a dict.
                for parent_key in parent_node:
                    if parent_node[parent_key] == node:
                        parent_node[parent_key] = newValue

    utils.walk(fields, _walk_field)

    return fields


class ConstructorReference:
    """Helper class to serialize !g.* fields."""

    def __init__(self, tag, pod_path):
        self.tag = tag
        self.pod_path = pod_path


def g_representer(dumper, data):
    """Allow the yaml dump to write out a representation of the !g.*."""
    return dumper.represent_scalar(data.tag, data.pod_path)


yaml.SafeDumper.add_representer(ConstructorReference, g_representer)
