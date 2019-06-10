---
layout: page
title: Sketches
permalink: /sketches/
---
### Sample displays of musical ideas from Prokofiev's notebooks.

#### Playable transcriptions encoded in [MEI](https://music-encoding.org/) and displayed with [Verovio](https://www.verovio.org/index.xhtml)

#### (MEI and MusicXML files [available here](../data-files))

<p>Verovio Collection</p>
<ul>
  {% for item in site.verovio %}
    <li>
      <h4><a href="/_verovio/{{ item.shortname }}/">{{ item.name }}</a></h4>
    </li>
  {% endfor %}
  </ul>

<!-- Markdown liquid 'link':

  [Link to a document]({% link _verovio/Fragment01.md %}) -->

Direct links to html files:

* <a href="../meimidi/Fragment01midi.html">__Fragment 1__</a>

* <a href="../meimidi/Fragment02midi.html">__Fragment 2__</a>

* <a href="../meimidi/Fragment04midi.html">__Fragment 4__</a>

* <a href="../meimidi/Fragment06midi.html">__Fragment 6__</a>

* <a href="../meimidi/Fragment07midi.html">__Fragment 7__</a>

* <a href="../meimidi/Fragment08midi.html">__Fragment 8__</a>

* <a href="../meimidi/Fragment09midi.html">__Fragment 9__</a>

* <a href="../meimidi/Fragment11midi.html">__Fragment 11__</a>

* <a href="../meimidi/Fragment12midi.html">__Fragment 12__</a>

* <a href="../meimidi/Fragment14midi.html">__Fragment 14__</a>

* <a href="../meimidi/Fragment15midi.html">__Fragment 15__</a>
