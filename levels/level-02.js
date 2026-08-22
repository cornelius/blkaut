const LEVEL_02 =
{
  "id": "level-02",
  "name": "Crosstown",
  "minMoves": 15,
  "width": 7,
  "height": 7,
  "walls": [[2, 2], [4, 4]],
  "doors": [
    { "side": "bottom", "from": 5, "to": 6, "color": "red" },
    { "side": "left",   "from": 0, "to": 1, "color": "blue" },
    { "side": "bottom", "from": 0, "to": 1, "color": "green" },
    { "side": "right",  "from": 5, "to": 6, "color": "yellow" }
  ],
  "blocks": [
    { "id": "r1", "color": "red",    "x": 0, "y": 0, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "b1", "color": "blue",   "x": 2, "y": 0, "cells": [[0, 0], [1, 0]] },
    { "id": "g1", "color": "green",  "x": 4, "y": 0, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "y1", "color": "yellow", "x": 6, "y": 0, "cells": [[0, 0], [0, 1]] },
    { "id": "g2", "color": "green",  "x": 2, "y": 1, "cells": [[0, 0], [1, 0]] },
    { "id": "y2", "color": "yellow", "x": 0, "y": 2, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "r2", "color": "red",    "x": 3, "y": 2, "cells": [[0, 0], [1, 0]] },
    { "id": "b2", "color": "blue",   "x": 5, "y": 2, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "y3", "color": "yellow", "x": 2, "y": 3, "cells": [[0, 0], [1, 0]] },
    { "id": "b3", "color": "blue",   "x": 0, "y": 4, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "g3", "color": "green",  "x": 2, "y": 4, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "r3", "color": "red",    "x": 5, "y": 4, "cells": [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { "id": "y4", "color": "yellow", "x": 4, "y": 5, "cells": [[0, 0]] }
  ]
}
;
