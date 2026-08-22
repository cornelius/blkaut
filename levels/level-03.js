const LEVEL_03 =
{
  "id": "level-03",
  "name": "Gridlock",
  "minMoves": 17,
  "width": 6,
  "height": 6,
  "walls": [[3, 1], [3, 3]],
  "doors": [
    { "side": "bottom", "from": 2, "to": 3, "color": "red" },
    { "side": "right",  "from": 0, "to": 1, "color": "blue" },
    { "side": "left",   "from": 2, "to": 3, "color": "green" },
    { "side": "bottom", "from": 4, "to": 5, "color": "yellow" }
  ],
  "blocks": [
    { "id": "r1", "color": "red",    "x": 0, "y": 0, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "b1", "color": "blue",   "x": 2, "y": 0, "cells": [[0, 0], [1, 0]] },
    { "id": "g1", "color": "green",  "x": 5, "y": 0, "cells": [[0, 0], [0, 1]] },
    { "id": "g2", "color": "green",  "x": 2, "y": 1, "cells": [[0, 0], [0, 1]] },
    { "id": "y1", "color": "yellow", "x": 0, "y": 2, "cells": [[0, 0], [1, 0]] },
    { "id": "r2", "color": "red",    "x": 3, "y": 2, "cells": [[0, 0], [1, 0]] },
    { "id": "y2", "color": "yellow", "x": 1, "y": 3, "cells": [[0, 0], [1, 0]] },
    { "id": "b2", "color": "blue",   "x": 4, "y": 3, "cells": [[0, 0], [1, 0]] },
    { "id": "g3", "color": "green",  "x": 0, "y": 4, "cells": [[0, 0], [1, 0]] },
    { "id": "b3", "color": "blue",   "x": 4, "y": 4, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] }
  ]
}
;
