# Blender Auto-Fix Normals Script

Copy and paste this into Blender's Python Console to automatically fix only the problem objects:

```python
import bpy
import bmesh

def fix_problem_normals():
    print("\n" + "="*60)
    print("🔧 AUTO-FIX FLIPPED NORMALS")
    print("="*60 + "\n")
    
    # List of objects with flipped normals from diagnosis
    problem_objects = [
        "Object_108", "Object_111", "Object_114", "Object_117",
        "Object_123", "Object_129", "Object_132", "Object_141",
        "Object_144", "Object_147", "Object_150", "Object_153",
        "Object_156", "Object_159", "Object_165", "Object_171",
        "Object_174", "Object_177", "Object_180", "Object_183",
        "Object_186", "Object_189", "Object_192", "Object_195",
        "Object_198", "Object_201", "Object_204", "Object_267",
        "Object_270", "Object_273", "Object_276", "Object_279",
        "Object_282", "Object_285", "Object_288", "Object_291",
        "Object_294", "Object_297", "Object_300", "Object_303",
        "Object_306", "Object_309", "Object_312", "Object_315",
        "Object_318", "Object_321", "Object_324"
    ]
    
    print(f"🎯 Targeting {len(problem_objects)} objects with flipped normals\n")
    
    fixed_count = 0
    not_found = []
    
    # Deselect all first
    bpy.ops.object.select_all(action='DESELECT')
    
    # Process each problem object
    for obj_name in problem_objects:
        obj = bpy.data.objects.get(obj_name)
        
        if obj and obj.type == 'MESH':
            print(f"🔧 Fixing: {obj_name}")
            
            # Select the object
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            
            # Enter edit mode
            bpy.ops.object.mode_set(mode='EDIT')
            
            # Select all faces
            bpy.ops.mesh.select_all(action='SELECT')
            
            # Recalculate normals outside
            bpy.ops.mesh.normals_make_consistent(inside=False)
            
            # Exit edit mode
            bpy.ops.object.mode_set(mode='OBJECT')
            
            # Deselect
            obj.select_set(False)
            
            fixed_count += 1
        else:
            not_found.append(obj_name)
            print(f"⚠️  Not found: {obj_name}")
    
    print("\n" + "="*60)
    print("✅ FIX COMPLETE")
    print("="*60)
    print(f"Fixed objects: {fixed_count}/{len(problem_objects)}")
    
    if not_found:
        print(f"\n⚠️  Objects not found: {len(not_found)}")
        for name in not_found:
            print(f"   - {name}")
    
    print("\n💡 Next steps:")
    print("   1. File → Export → glTF 2.0 (.glb)")
    print("   2. Export to Downloads folder")
    print("   3. Copy to project: public/drone.glb")
    print("\n" + "="*60 + "\n")

# Run the fix
fix_problem_normals()
```

---

## What This Script Does:

1. 🎯 Targets only the 47 objects with flipped normals
2. 🔧 Automatically fixes each one using "Recalculate Outside"
3. ✅ Reports progress and completion
4. ⚠️ Alerts if any objects weren't found

## How to Use:

1. **Open Blender** with your drone model
2. Switch to **Scripting** workspace
3. Open **Python Console**
4. **Copy the Python code above** (lines 6-83)
5. **Paste** into console (Ctrl+V)
6. Press **Enter**

## Expected Output:

```
============================================================
🔧 AUTO-FIX FLIPPED NORMALS
============================================================

🎯 Targeting 47 objects with flipped normals

🔧 Fixing: Object_108
🔧 Fixing: Object_111
🔧 Fixing: Object_114
...
🔧 Fixing: Object_324

============================================================
✅ FIX COMPLETE
============================================================
Fixed objects: 47/47

💡 Next steps:
   1. File → Export → glTF 2.0 (.glb)
   2. Export to Downloads folder
   3. Copy to project: public/drone.glb
============================================================
```

## After Running:

The script leaves your scene in Object Mode with all changes applied. Simply export the GLB and the viewer will work perfectly!

## Why This Approach?

- ✅ **Surgical fix** - Only touches problem objects
- ✅ **Preserves good normals** - Doesn't risk breaking working objects
- ✅ **Automated** - One paste, done
- ✅ **Safe** - Non-destructive (save your .blend first if worried)
