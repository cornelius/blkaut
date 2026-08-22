const LEVEL_01 =
{
  "id": "level-01",
  "name": "First Light",
  "par": 10,
  "width": 6,
  "height": 6,
  "walls": [[2, 1], [3, 1], [1, 3]],
  "doors": [
    { "side": "top",    "from": 1, "to": 2, "color": "red" },
    { "side": "right",  "from": 0, "to": 1, "color": "blue" },
    { "side": "bottom", "from": 3, "to": 4, "color": "green" },
    { "side": "left",   "from": 3, "to": 4, "color": "yellow" }
  ],
  "blocks": [
    { "id": "g1", "color": "green",  "x": 0, "y": 0, "cells": [[0, 0], [1, 0]] },
    { "id": "b1", "color": "blue",   "x": 2, "y": 0, "cells": [[0, 0], [1, 0]] },
    { "id": "r1", "color": "red",    "x": 4, "y": 1, "cells": [[0, 0], [1, 0]] },
    { "id": "y1", "color": "yellow", "x": 0, "y": 1, "cells": [[0, 0], [0, 1]] },
    { "id": "g2", "color": "green",  "x": 2, "y": 3, "cells": [[0, 0], [0, 1]] },
    { "id": "b2", "color": "blue",   "x": 4, "y": 3, "cells": [[0, 0], [0, 1]] },
    { "id": "r2", "color": "red",    "x": 0, "y": 4, "cells": [[0, 0], [1, 0]] },
    { "id": "y2", "color": "yellow", "x": 3, "y": 5, "cells": [[0, 0], [1, 0]] }
  ]
}
;
