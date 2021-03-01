/**
 * Field types for the editor extension.
 */

import {
  GroupField,
  VariantField,
} from 'selective-edit'
import {
  DocumentField,
  StaticField,
  StringField,
  YamlField,
} from './field/constructor'
import {
  ImageFileField,
  GoogleImageField,
} from './field/image'
import {
  MediaFileField,
  GoogleMediaField,
} from './field/media'
import {
  EditorListField,
} from './field/list'
import {
  PartialsField,
} from './field/partials'
import {
  CheckboxField,
  DateField,
  DateTimeField,
  HtmlField,
  MarkdownField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from './field/standard'

export const defaultFields = {
  'checkbox': CheckboxField,
  'date': DateField,
  'datetime': DateTimeField,
  'document': DocumentField,
  'google_image': GoogleImageField,
  'google_media': GoogleMediaField,
  'group': GroupField,
  'html': HtmlField,
  'image': ImageFileField,
  'list': EditorListField,
  'markdown': MarkdownField,
  'media': MediaFileField,
  'number': NumberField,
  'partials': PartialsField,
  'select': SelectField,
  'static': StaticField,
  'string': StringField,
  'text': TextField,
  'textarea': TextareaField,
  'variant': VariantField,
  'yaml': YamlField,
}
