
# Virtuelle Maschine für Aarch64

Weil die Zugriffe etwas komplizierter wurden, dachte ich mir, dass ich das Debugging ein bisschen einfacher mache.

Also habe ich für die Befehle, die wir für die Aufgabe brauchen, eine kleine virtuelle Maschine programmiert.
Als Nebeneffekt zum schöneren Debugging mit Zeigern auf die Zellen in 2D ohne Umrechnung im Kopf, ist es auch eine schöne Visualisierung :)

Das Umschreiben von 19x4x4, um ein paar Additionen zu sparen, hat es ein bisschen vereinfacht.

## Ausführung von anderem Assembly-Code als meinen Beispielen

Wenn man eine andere Matrixmultiplikation testen möchte, muss man nur den Code in die Html-Datei in das Element "code" pasten.
Das Element "mkn" definiert m, k und n für die Darstellung und die Kontrolle vom Ergebnis und das Element "delay" legt das Startdelay für die Berechnungs-Animation fest.

Beachten muss man allerdings, dass ich bisher nur implementiert habe, was ich auch selber verwendet habe.
- es gibt das NZCV-Register noch nicht
- es gibt demzufolge kein cmp und kein b/blt/b..
- Berechnungen sind nur auf Float32s möglich
- man kann nur Float32s aus dem Speicher laden und in den Speicher schreiben
- es gibt noch keinen Stack
- man kann keinen eigenen Speicher definieren
- usw.

Addition und Subtraktion von Pointern funktioniert nicht, weil wir in der Vorlesung dafür keine Anwendung haben und auch sonst kaum jemand Pointer addieren oder subtrahieren sollte (außer um vielleicht eine Länge zu bestimmen).



Es ist nicht meine erste virtuelle Maschine und hat Spaß gemacht, zu programmieren :)
Für das Hardware-Praktikum ("Experimentelle Hardware-Projekte") habe ich mir mal eine VM gebastelt, um alles auch ohne vor Ort zu sein, ausprobieren zu können: [Link zu der VM auf meiner Website](https://phychi.com/asm/)