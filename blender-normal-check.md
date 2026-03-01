# Blender Normal Diagnosis Script

Copy and paste this into Blender's Python Console to check for face orientation issues:

```python
import bpy
import bmesh

def check_normals():
    print("\n" + "="*60)
    print("🔍 NORMAL ORIENTATION DIAGNOSIS")
    print("="*60 + "\n")
    
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    
    if not mesh_objects:
        print("❌ No mesh objects found in scene")
        return
    
    print(f"📊 Analyzing {len(mesh_objects)} mesh objects...\n")
    
    total_faces = 0
    total_flipped = 0
    objects_with_issues = []
    
    for obj in mesh_objects:
        # Create BMesh from object
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        
        face_count = len(bm.faces)
        total_faces += face_count
        
        # Check for flipped normals (negative Z component in local space)
        flipped_faces = 0
        inconsistent = False
        
        if face_count > 0:
            # Get average normal direction
            avg_normal = sum((f.normal for f in bm.faces), bm.faces[0].normal.copy() * 0) / face_count
            
            # Check each face
            for face in bm.faces:
                # If face normal points opposite to average, it might be flipped
                if face.normal.dot(avg_normal) < -0.1:
                    flipped_faces += 1
            
            if flipped_faces > 0:
                inconsistent = True
                total_flipped += flipped_faces
                objects_with_issues.append(obj.name)
        
        # Print object info
        status = "⚠️  INCONSISTENT" if inconsistent else "✅ OK"
        print(f"{status} | {obj.name}")
        print(f"   Faces: {face_count}")
        if inconsistent:
            print(f"   Flipped: {flipped_faces} ({(flipped_faces/face_count*100):.1f}%)")
        print()
        
        bm.free()
    
    # Summary
    print("="*60)
    print("📋 SUMMARY")
    print("="*60)
    print(f"Total faces: {total_faces}")
    print(f"Flipped faces: {total_flipped} ({(total_flipped/total_faces*100 if total_faces > 0 else 0):.1f}%)")
    print(f"Objects with issues: {len(objects_with_issues)}")
    
    if objects_with_issues:
        print("\n⚠️  OBJECTS WITH FLIPPED NORMALS:")
        for obj_name in objects_with_issues:
            print(f"   - {obj_name}")
        print("\n💡 FIX: Select object → Edit Mode → Mesh → Normals → Recalculate Outside (Shift+N)")
    else:
        print("\n✅ All normals are correctly oriented!")
    
    print("\n" + "="*60 + "\n")

# Run the check
check_normals()
```

---

## What This Script Does:

1. ✅ Scans all mesh objects in the scene
2. 🔍 Analyzes face normal directions
3. ⚠️ Identifies faces pointing the wrong way
4. 📊 Provides per-object and total statistics
5. 💡 Suggests the fix command

## How to Use:

1. Open Blender with your drone model
2. Switch to **Scripting** workspace (top menu bar)
3. Open **Python Console** (bottom panel)
4. **Copy the code above** (just the Python part, not the markdown)
5. **Paste** into the console (Ctrl+V)
6. Press **Enter**

## Expected Output:

```
============================================================
🔍 NORMAL ORIENTATION DIAGNOSIS
============================================================

✅ OK | Body_Frame
   Faces: 2840

⚠️  INCONSISTENT | Motor_Mount_01
   Faces: 186
   Flipped: 93 (50.0%)

============================================================
📋 SUMMARY
============================================================
Total faces: 45623
Flipped faces: 2341 (5.1%)
Objects with issues: 12

⚠️  OBJECTS WITH FLIPPED NORMALS:
   - Motor_Mount_01
   - Camera_Bracket
   ...

💡 FIX: Select object → Edit Mode → Mesh → Normals → Recalculate Outside (Shift+N)
============================================================
```

## If Issues Found:

**Quick Fix (All Objects):**
1. Select All (A)
2. Tab → Edit Mode
3. Select All (A)
4. Mesh → Normals → Recalculate Outside (Shift+N)
5. Tab → Object Mode
6. Re-export as GLB

**Or fix in Three.js** by setting double-sided rendering (less ideal but works).
