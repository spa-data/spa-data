---
layout: page
title: Sketches
permalink: /sketches/
---
### Sample displays of musical ideas from Prokofiev's notebooks.

Playable transcriptions encoded in [MEI](https://music-encoding.org/) and displayed with [Verovio](https://www.verovio.org/index.xhtml)

(MEI and MusicXML files [available here](../data-files))

<!-- Verovio document collection -->

<ul>
  {% for item in site.verovio %}
    <li>
    <h3>{{ item.name }} - {{ item.imgfile }}</h3>
    <p>
      <a href="{{ site.baseurl }}/verovio/{{ item.shortname }}/">{{ item.name }}</a>
  {% endfor %}
</ul>
