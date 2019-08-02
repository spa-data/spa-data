---
layout: page
title: Sketches
permalink: /sketches/
---
### Sample displays of musical ideas from Prokofiev's notebooks.

Playable transcriptions encoded in [MEI](https://music-encoding.org/) and displayed with [Verovio](https://www.verovio.org/index.xhtml)

(MEI and MusicXML files [available here](../data-files))

<!-- Verovio document collection -->

<!-- <table>
{% tablerow  item in site.verovio cols:2 %}
<a href="{{ site.baseurl }}/verovio/{{ item.shortname }}/">{{ item.name }}</a>
{% endtablerow %}
</table> -->

<font size="+1">
<ul>
  {% for item in site.verovio %}
    <li>
      <a href="{{ site.baseurl }}/verovio/{{ item.shortname }}/">{{ item.name }}</a>
    </li>
  {% endfor %}
</ul>
</font>
